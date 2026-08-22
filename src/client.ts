/**
 * The fetch+parse client. All public methods fetch HTML via the (injectable)
 * `fetch` implementation, parse with the pure `parse/*` functions, and project
 * results down to the caller's requested option flags.
 *
 * Pagination is "next-link driven": the authoritative "Next page >>" URL is
 * read from each page's HTML rather than reconstructed, so the library is
 * robust across inkeedecoder.com's differing param schemes (`ppage`,
 * `uoffset`, `offset`).
 */
import { makePaginated, paginateAll, type RawList } from "./pagination.js";
import {
  parseIngredientPage,
  parseIngredientProductsPage,
} from "./parse/ingredient.js";
import {
  parseBrandPage,
  parseIngredientFunctionPage,
  parseSearchPage,
  parseSearchProductsPage,
} from "./parse/lists.js";
import { parseProductPage } from "./parse/product.js";
import type {
  Brand,
  ClientOptions,
  Ingredient,
  IngredientFunction,
  IngredientProductsResult,
  IngredientQuery,
  InkeedecoderClient,
  ListQuery,
  Product,
  ProductQuery,
  ProductSearchFilters,
  ProductSearchResult,
  Ref,
  SearchQuery,
  SearchResult,
  SearchTab,
  SearchTabResult,
} from "./types.js";
import { isAbsoluteUrl, joinUrl, normalizeEntityId } from "./util/refs.js";

const DEFAULT_BASE_URL = "https://inkeedecoder.com";
const DEFAULT_REQUEST_INTERVAL_MS = 1000;
const DEFAULT_MAX_PAGES = 25;
const DEFAULT_USER_AGENT =
  "@knorby/inkeedecoder-client/0 (+https://github.com/knorby/inkeedecoder-client)";

/** Build a query string, `+`-encoding spaces to match inkeedecoder.com URLs. */
function buildQuery(
  params: ReadonlyArray<readonly [string, string | string[] | undefined]>,
): string {
  const parts: string[] = [];
  for (const [key, value] of params) {
    if (value === undefined) {
      continue;
    }
    const arr = Array.isArray(value) ? value : [value];
    for (const item of arr) {
      if (item === undefined || item === "") {
        continue;
      }
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(item).replace(/%20/g, "+")}`,
      );
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Resolve the full URL for a target (path or absolute URL). */
function toUrl(baseUrl: string, target: string): string {
  return isAbsoluteUrl(target) ? target : joinUrl(baseUrl, target);
}

interface ResolvedProductQuery {
  brand: boolean;
  description: boolean;
  ingredients: boolean;
  images: "none" | "original" | "all";
  hashtags: boolean;
  fullName: boolean;
  functions: boolean;
  skimTable: boolean;
  dates: boolean;
  tooltips: boolean;
  longDescriptions: boolean;
}

function resolveProductQuery(opts?: ProductQuery): ResolvedProductQuery {
  return {
    brand: opts?.brand ?? true,
    description: opts?.description ?? true,
    ingredients: opts?.ingredients ?? true,
    images: opts?.images ?? "original",
    hashtags: opts?.hashtags ?? true,
    fullName: opts?.fullName ?? false,
    functions: opts?.functions ?? false,
    skimTable: opts?.skimTable ?? false,
    dates: opts?.dates ?? false,
    tooltips: opts?.tooltips ?? false,
    longDescriptions: opts?.longDescriptions ?? false,
  };
}

function projectProduct(p: Product, r: ResolvedProductQuery): Product {
  const out: Product = {
    slug: p.slug,
    name: p.name,
    path: p.path,
    url: p.url,
  };
  if (r.ingredients) {
    out.ingredients = p.ingredients;
  }
  if (r.brand && p.brand) {
    out.brand = p.brand;
  }
  if (r.description && p.description !== undefined) {
    out.description = p.description;
  }
  if (r.images !== "none" && p.images) {
    out.images =
      r.images === "original" ? { original: p.images.original } : p.images;
  }
  if (r.hashtags && p.hashtags) {
    out.hashtags = p.hashtags;
  }
  if (r.fullName && p.fullName) {
    out.fullName = p.fullName;
  }
  if (r.functions && p.functions) {
    out.functions = p.functions;
  }
  if (r.skimTable && p.skimTable) {
    out.skimTable = p.skimTable;
  }
  if (r.dates && p.dates) {
    out.dates = p.dates;
  }
  if (r.tooltips && p.tooltips) {
    out.tooltips = p.tooltips;
  }
  if (r.longDescriptions && p.longDescriptions) {
    out.longDescriptions = p.longDescriptions;
  }
  return out;
}

interface ResolvedIngredientQuery {
  functions: boolean;
  safety: boolean;
  alsoCalled: boolean;
  image: boolean;
  cosing: boolean;
  details: boolean;
  proof: boolean;
}

function resolveIngredientQuery(
  opts?: IngredientQuery,
): ResolvedIngredientQuery {
  return {
    functions: opts?.functions ?? true,
    safety: opts?.safety ?? true,
    alsoCalled: opts?.alsoCalled ?? true,
    image: opts?.image ?? true,
    cosing: opts?.cosing ?? false,
    details: opts?.details ?? false,
    proof: opts?.proof ?? false,
  };
}

function projectIngredient(
  ing: Ingredient,
  r: ResolvedIngredientQuery,
): Ingredient {
  const out: Ingredient = {
    slug: ing.slug,
    name: ing.name,
    path: ing.path,
    url: ing.url,
    // Basic output: always present, `null` when the page has no rating.
    ourTake: ing.ourTake ?? null,
  };
  if (r.functions) {
    out.functions = ing.functions;
  }
  if (r.alsoCalled && ing.alsoCalled !== undefined) {
    out.alsoCalled = ing.alsoCalled;
  }
  if (r.image && ing.image !== undefined) {
    out.image = ing.image;
  }
  if (r.safety) {
    if (ing.irritancy !== undefined) {
      out.irritancy = ing.irritancy;
    }
    if (ing.comedogenicity !== undefined) {
      out.comedogenicity = ing.comedogenicity;
    }
  }
  if (r.cosing && ing.cosing) {
    out.cosing = ing.cosing;
  }
  if (r.details && ing.details !== undefined) {
    out.details = ing.details;
  }
  if (r.proof && ing.proof) {
    out.proof = ing.proof;
  }
  return out;
}

/**
 * Create an inkeedecoder.com client. The client is stateless aside from its
 * configuration; safe to share across an app.
 */
export function createInkeedecoderClient(
  options: ClientOptions = {},
): InkeedecoderClient {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;
  const extraHeaders = options.headers ?? {};
  const requestIntervalMs =
    options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

  if (typeof doFetch !== "function") {
    throw new Error(
      "createInkeedecoderClient: no global `fetch` available. Pass `fetch` in options.",
    );
  }

  const defaultHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    ...extraHeaders,
  };

  async function fetchHtml(target: string): Promise<string> {
    const url = toUrl(baseUrl, target);
    const res = await doFetch(url, { headers: defaultHeaders });
    if (!res.ok) {
      throw new Error(
        `Request to ${url} failed: ${res.status} ${res.statusText}`,
      );
    }
    return res.text();
  }

  function paginateOpts() {
    return { maxPages, delayMs: requestIntervalMs };
  }

  /**
   * Simple search implementation (typed by the `search` overloads on
   * {@link InkeedecoderClient}). Without `opts.tab` both tabs are returned;
   * with `opts.tab` a single tab is fetched in exactly one request per page
   * (and only that tab is walked for `allPages`).
   */
  async function search(
    query: string,
    opts?: SearchQuery,
  ): Promise<SearchResult | SearchTabResult> {
    const page = pageOf(opts);
    // Per-tab URL: `activetab` selects the tab, `ppage` the page within it
    // (the site's own "Next page >>" links on tabs use this scheme).
    const tabUrl = (tab: SearchTab, p: number) =>
      `/search${buildQuery([
        ["query", query],
        ["activetab", tab],
        ["ppage", p > 1 ? String(p) : undefined],
      ])}`;

    // Single tab: one request for the requested page. allPages always walks
    // from page 1, ignoring `opts.page` (matching every other list method).
    if (opts?.tab) {
      const tab = opts.tab;
      const wantAll = opts.allPages === true;
      const first = parseSearchPage(
        await fetchHtml(tabUrl(tab, wantAll ? 1 : page)),
        baseUrl,
      );
      if (!wantAll) {
        return {
          query: first.query || query,
          tab,
          results: makePaginated(first[tab], page),
        };
      }
      // allPages: walk only this tab from page 1.
      const merged = await paginateAll<Ref>(
        first[tab],
        async (url) => parseSearchPage(await fetchHtml(url), baseUrl)[tab],
        paginateOpts(),
      );
      return {
        query: first.query || query,
        tab,
        results: makePaginated(merged, 1),
      };
    }

    // Page 1 is the combined page (both tabs). Deeper pages are per-tab —
    // the site paginates each tab independently via `activetab` + `ppage`
    // (see its own "Next page >>" links) — so fetch each tab at `page`.
    if (opts?.allPages !== true && page > 1) {
      const productsParsed = parseSearchPage(
        await fetchHtml(tabUrl("products", page)),
        baseUrl,
      );
      const ingredientsParsed = parseSearchPage(
        await fetchHtml(tabUrl("ingredients", page)),
        baseUrl,
      );
      return {
        query: productsParsed.query || query,
        products: makePaginated(productsParsed.products, page),
        ingredients: makePaginated(ingredientsParsed.ingredients, page),
      };
    }

    const parsed = parseSearchPage(
      await fetchHtml(`/search${buildQuery([["query", query]])}`),
      baseUrl,
    );

    if (opts?.allPages !== true) {
      return {
        query: parsed.query,
        products: makePaginated(parsed.products, page),
        ingredients: makePaginated(parsed.ingredients, page),
      };
    }

    const po = paginateOpts();
    const mergedProducts = await paginateAll<Ref>(
      parsed.products,
      async (url) => parseSearchPage(await fetchHtml(url), baseUrl).products,
      po,
    );
    const mergedIngredients = await paginateAll<Ref>(
      parsed.ingredients,
      async (url) => parseSearchPage(await fetchHtml(url), baseUrl).ingredients,
      po,
    );
    return {
      query: parsed.query,
      products: makePaginated(mergedProducts, 1),
      ingredients: makePaginated(mergedIngredients, 1),
    };
  }

  const client: InkeedecoderClient = {
    fetchHtml,

    search: search as InkeedecoderClient["search"],

    async searchProducts(
      filters: ProductSearchFilters,
      opts?: ListQuery,
    ): Promise<ProductSearchResult> {
      const wantAll = opts?.allPages === true;
      const page = pageOf(opts);
      const path =
        "/search/product" +
        buildQuery([
          ["query", filters.query],
          ["include", filters.include ?? []],
          ["exclude", filters.exclude ?? []],
          ["include-mode", filters.includeMode === "any" ? "any" : undefined],
          ["ppage", !wantAll && page > 1 ? String(page) : undefined],
        ]);

      if (!wantAll) {
        const raw = parseSearchProductsPage(await fetchHtml(path), baseUrl);
        return makePaginated(raw, page);
      }

      const first = parseSearchProductsPage(await fetchHtml(path), baseUrl);
      const merged = await paginateAll<Ref>(
        first,
        async (url) => parseSearchProductsPage(await fetchHtml(url), baseUrl),
        paginateOpts(),
      );
      return makePaginated(merged, 1);
    },

    async getProduct(id: string, opts?: ProductQuery): Promise<Product> {
      const { slug, path } = normalizeEntityId(id, "products");
      const html = await fetchHtml(path);
      const full = parseProductPage(html, baseUrl);
      // Override identity with the normalized id (canonical).
      if (!full.slug) {
        full.slug = slug;
      }
      full.path = path;
      full.url = joinUrl(baseUrl, path);
      return projectProduct(full, resolveProductQuery(opts));
    },

    async getIngredient(
      id: string,
      opts?: IngredientQuery,
    ): Promise<Ingredient> {
      const { slug, path } = normalizeEntityId(id, "ingredients");
      const html = await fetchHtml(path);
      const full = parseIngredientPage(html, baseUrl);
      if (!full.slug) {
        full.slug = slug;
      }
      full.path = path;
      full.url = joinUrl(baseUrl, path);
      return projectIngredient(full, resolveIngredientQuery(opts));
    },

    async getIngredientProducts(
      id: string,
      opts?: ListQuery & { includeKnownAmount?: boolean },
    ): Promise<IngredientProductsResult> {
      const { path } = normalizeEntityId(id, "ingredients");
      const page = pageOf(opts);
      const includeKnown = opts?.includeKnownAmount === true;

      // Not aggregating: fetch the requested page directly.
      if (opts?.allPages !== true) {
        const url = page > 1 ? `${path}?uoffset=${page - 1}` : path;
        const parsed = parseIngredientProductsPage(
          await fetchHtml(url),
          baseUrl,
        );
        return {
          products: makePaginated(parsed.products, page),
          knownAmountProducts:
            includeKnown && page === 1 ? parsed.knownAmountProducts : undefined,
        };
      }

      // allPages: start at page 1 and follow "Next page" links.
      const first = parseIngredientProductsPage(await fetchHtml(path), baseUrl);
      const merged = await paginateAll<Ref>(
        first.products,
        async (url) =>
          parseIngredientProductsPage(await fetchHtml(url), baseUrl).products,
        paginateOpts(),
      );
      return {
        products: makePaginated(merged, 1),
        knownAmountProducts: includeKnown
          ? first.knownAmountProducts
          : undefined,
      };
    },

    async getBrand(id: string, opts?: ListQuery): Promise<Brand> {
      const { slug, path } = normalizeEntityId(id, "brands");
      const page = pageOf(opts);
      const wantAll = opts?.allPages === true;
      const pageParam = (p: number) => (p > 1 ? `?offset=${p - 1}` : "");
      // allPages always walks from page 1, ignoring `opts.page`.
      const firstPage = wantAll ? 1 : page;
      const firstParsed = parseBrandPage(
        await fetchHtml(path + pageParam(firstPage)),
        baseUrl,
      );
      const raw: RawList<Ref> = wantAll
        ? await paginateAll<Ref>(
            firstParsed.products,
            async (url) =>
              parseBrandPage(await fetchHtml(url), baseUrl).products,
            paginateOpts(),
          )
        : firstParsed.products;
      return {
        slug,
        name: firstParsed.name,
        path,
        url: joinUrl(baseUrl, path),
        products: makePaginated(raw, firstPage),
      };
    },

    async getIngredientFunction(
      id: string,
      opts?: ListQuery,
    ): Promise<IngredientFunction> {
      const { slug, path } = normalizeEntityId(id, "ingredient-functions");
      const pageParam = (p: number) => (p > 1 ? `?offset=${p - 1}` : "");
      const firstUrl = path + pageParam(pageOf(opts));
      const wantAll = opts?.allPages === true;

      if (!wantAll) {
        const html = await fetchHtml(firstUrl);
        const parsed = parseIngredientFunctionPage(html, baseUrl);
        return {
          slug,
          name: parsed.name,
          path,
          url: joinUrl(baseUrl, path),
          description: parsed.description,
          ingredients: makePaginated(parsed.ingredients, pageOf(opts)),
        };
      }

      const firstHtml = await fetchHtml(path + pageParam(1));
      const firstParsed = parseIngredientFunctionPage(firstHtml, baseUrl);
      const merged = await paginateAll<Ref>(
        firstParsed.ingredients,
        async (url) =>
          parseIngredientFunctionPage(await fetchHtml(url), baseUrl)
            .ingredients,
        paginateOpts(),
      );
      return {
        slug,
        name: firstParsed.name,
        path,
        url: joinUrl(baseUrl, path),
        description: firstParsed.description,
        ingredients: makePaginated(merged, 1),
      };
    },
  };

  return client;
}

function pageOf(opts: ListQuery | undefined): number {
  const p = opts?.page ?? 1;
  return p < 1 ? 1 : p;
}
