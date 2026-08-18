import { describe, expect, it, vi } from "vitest";
import { createInkeedecoderClient } from "../src/client.js";
import { BASE_URL, fixture } from "./helpers.js";

/**
 * A fake `fetch` that records every requested URL and serves captured
 * fixture HTML by URL substring match, falling back to an empty page so
 * auto-pagination loops terminate cleanly.
 */
function makeFetch(
  routes: ReadonlyArray<{ match: string; file?: string; html?: string }>,
  urls: string[] = [],
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    urls.push(url);
    for (const route of routes) {
      if (url.includes(route.match)) {
        const body = route.file ? fixture(route.file) : (route.html ?? "");
        return makeResponse(body);
      }
    }
    // Default: empty but well-formed shell so loops end with hasMore=false.
    return makeResponse(
      "<div class='detailpage'><div id='products'></div><div id='ingredients'></div></div>",
    );
  }) as unknown as typeof fetch;
}

function makeResponse(body: string): Response {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => body,
  } as unknown as Response;
}

const EMPTY_HTML = "<html><body></body></html>";

const ROUTES: ReadonlyArray<{ match: string; file?: string; html?: string }> = [
  // Per-tab search pages for the squalane query (must precede the generic
  // ppage catch-all below).
  {
    match: "query=squalane&activetab=products&ppage=2",
    file: "search-squalane-products-page2.html",
  },
  {
    match: "query=squalane&activetab=ingredients&ppage=2",
    html: "<div id='ingredients'><a class='simpletextlistitem' href='/ingredients/squalane'>Squalane</a></div>",
  },
  // Next-page URLs return an empty page so allPages loops terminate.
  { match: "ppage=", html: EMPTY_HTML },
  { match: "uoffset=", html: EMPTY_HTML },
  { match: "offset=", html: EMPTY_HTML },
  // Content pages.
  {
    match: "/products/the-ordinary-retinol-1-in-squalane",
    file: "product-the-ordinary-retinol-1-in-squalane.html",
  },
  { match: "/ingredients/squalane", file: "ingredient-squalane.html" },
  { match: "/ingredients/tocopherol", file: "ingredient-tocopherol.html" },
  { match: "/search?query=the+ordinary", file: "search-the-ordinary.html" },
  {
    match: "/search/product?query=the+ordinary",
    file: "search-products-advanced.html",
  },
  { match: "/brands/the-ordinary", file: "brand-the-ordinary.html" },
  {
    match: "/ingredient-functions/emollient",
    file: "ingredient-function-emollient.html",
  },
];

/** A client plus the URLs its fake transport has requested so far. */
function makeClient() {
  const urls: string[] = [];
  const c = createInkeedecoderClient({
    baseUrl: BASE_URL,
    fetch: makeFetch(ROUTES, urls),
    requestIntervalMs: 0,
    maxPages: 50,
  });
  return { c, urls };
}

function client() {
  return makeClient().c;
}

describe("getProduct — default (lean) options", () => {
  it("returns core fields only", async () => {
    const p = await client().getProduct("the-ordinary-retinol-1-in-squalane");
    expect(p.name).toBe("Retinol 1% In Squalane");
    expect(p.brand?.slug).toBe("the-ordinary");
    expect(p.description).toMatch(/^This water-free/);
    expect(p.ingredients?.length).toBe(8);
    expect(p.images?.original).toMatch(/front_photo_original/);
    expect(p.images?.webp).toBeUndefined(); // 'original' mode
    expect(p.hashtags?.length).toBe(3);
    // Verbose fields are off by default.
    expect(p.functions).toBeUndefined();
    expect(p.skimTable).toBeUndefined();
    expect(p.dates).toBeUndefined();
    expect(p.tooltips).toBeUndefined();
    expect(p.longDescriptions).toBeUndefined();
    expect(p.fullName).toBeUndefined();
  });

  it("omits disabled sections entirely (no empty placeholders)", async () => {
    const p = await client().getProduct("the-ordinary-retinol-1-in-squalane", {
      brand: false,
      description: false,
      ingredients: false,
      images: "none",
      hashtags: false,
    });
    expect("brand" in p).toBe(false);
    expect("description" in p).toBe(false);
    expect("ingredients" in p).toBe(false);
    expect("images" in p).toBe(false);
    expect("hashtags" in p).toBe(false);
  });
});

describe("getProduct — full options", () => {
  it("returns every verbose section", async () => {
    const p = await client().getProduct("the-ordinary-retinol-1-in-squalane", {
      images: "all",
      fullName: true,
      functions: true,
      skimTable: true,
      dates: true,
      tooltips: true,
      longDescriptions: true,
    });
    expect(p.images?.webp?.length).toBe(3);
    expect(p.fullName).toBe("The Ordinary Retinol 1% In Squalane");
    expect(p.functions?.key.length).toBe(4);
    expect(p.skimTable?.length).toBe(8);
    expect(p.dates?.uploadedBy).toBe("andreas");
    expect(p.tooltips?.length).toBe(8);
    expect(p.longDescriptions?.length).toBe(8);
  });
});

describe("getIngredient — default vs verbose", () => {
  it("includes functions/safety/image by default", async () => {
    const ing = await client().getIngredient("squalane");
    expect(ing.name).toBe("Squalane");
    expect(ing.ourTake).toBe("goodie");
    expect(ing.functions?.map((f) => f.slug)).toContain("emollient");
    expect(ing.irritancy).toBe("0");
    expect(ing.image).toMatch(/squalane_original/);
    expect(ing.cosing).toBeUndefined();
    expect(ing.details).toBeUndefined();
    expect(ing.proof).toBeUndefined();
  });

  it("opts into cosing/details/proof", async () => {
    const ing = await client().getIngredient("squalane", {
      cosing: true,
      details: true,
      proof: true,
    });
    expect(ing.cosing?.cas).toBe("111-01-3");
    expect(ing.details).toMatch(/^It seems to us/);
    expect(ing.proof?.length).toBeGreaterThan(0);
  });

  it("omits disabled sections and keeps ourTake (null when unrated)", async () => {
    const ing = await client().getIngredient("squalane", {
      functions: false,
      safety: false,
      alsoCalled: false,
      image: false,
    });
    expect("functions" in ing).toBe(false);
    expect("irritancy" in ing).toBe(false);
    expect("alsoCalled" in ing).toBe(false);
    expect("image" in ing).toBe(false);
    expect(ing.ourTake).toBe("goodie");

    const blank = createInkeedecoderClient({
      baseUrl: BASE_URL,
      fetch: makeFetch([{ match: "", html: EMPTY_HTML }]),
      requestIntervalMs: 0,
    });
    const unrated = await blank.getIngredient("squalane");
    expect(unrated.ourTake).toBeNull();
  });
});

describe("search", () => {
  it("returns combined first page (products + ingredients)", async () => {
    const r = await client().search("the ordinary");
    expect(r.query).toBe("the ordinary");
    expect(r.products.items.length).toBe(50);
    expect(r.ingredients.items.length).toBe(0);
    expect(r.products.hasMore).toBe(true);
    expect(r.products.nextPageUrl).toMatch(/ppage=2/);
    expect(r.products.page).toBe(1);
  });

  it("fetches each tab separately for page > 1", async () => {
    const { c, urls } = makeClient();
    const r = await c.search("squalane", { page: 2 });
    expect(urls[0]).toBe(
      "https://inkeedecoder.com/search?query=squalane&activetab=products&ppage=2",
    );
    expect(urls[1]).toBe(
      "https://inkeedecoder.com/search?query=squalane&activetab=ingredients&ppage=2",
    );
    expect(urls.length).toBe(2);
    expect(r.products.page).toBe(2);
    expect(r.products.items.length).toBeGreaterThan(0);
    expect(r.ingredients.items.length).toBe(1);
    expect(r.ingredients.items[0]?.slug).toBe("squalane");
  });

  it("follows all pages (page 2 yields no further items)", async () => {
    const { c, urls } = makeClient();
    const r = await c.search("the ordinary", { allPages: true });
    expect(r.products.items.length).toBe(50); // page 2 was empty
    expect(r.products.hasMore).toBe(false);
    expect(urls.some((u) => u.includes("ppage=2"))).toBe(true);
  });

  describe("tab selector", () => {
    it("fetches a single tab in one request at page 1", async () => {
      const { c, urls } = makeClient();
      const r = await c.search("the ordinary", { tab: "products" });
      expect(urls).toEqual([
        "https://inkeedecoder.com/search?query=the+ordinary&activetab=products",
      ]);
      expect(r.tab).toBe("products");
      expect(r.query).toBe("the ordinary");
      expect(r.results.page).toBe(1);
      expect(r.results.items.length).toBe(50);
      expect(r.results.hasMore).toBe(true);
      expect(r.results.nextPageUrl).toMatch(/activetab=products&ppage=2/);
    });

    it("fetches a single tab in one request at page >= 2", async () => {
      const { c, urls } = makeClient();
      const r = await c.search("squalane", { page: 2, tab: "products" });
      expect(urls).toEqual([
        "https://inkeedecoder.com/search?query=squalane&activetab=products&ppage=2",
      ]);
      expect(r.tab).toBe("products");
      expect(r.results.page).toBe(2);
      expect(r.results.items.length).toBeGreaterThan(0);
    });

    it("walks only the chosen tab for allPages", async () => {
      const { c, urls } = makeClient();
      const r = await c.search("the ordinary", {
        tab: "products",
        allPages: true,
      });
      // Page 1 + the (empty) ppage=2 follow-up; the ingredients tab is
      // never requested.
      expect(urls.length).toBe(2);
      expect(urls.every((u) => !u.includes("activetab=ingredients"))).toBe(
        true,
      );
      expect(r.tab).toBe("products");
      expect(r.results.items.length).toBe(50);
      expect(r.results.hasMore).toBe(false);
    });

    it("fetches the ingredients tab alone", async () => {
      const { c, urls } = makeClient();
      const r = await c.search("squalane", { page: 2, tab: "ingredients" });
      expect(urls).toEqual([
        "https://inkeedecoder.com/search?query=squalane&activetab=ingredients&ppage=2",
      ]);
      expect(r.tab).toBe("ingredients");
      expect(r.results.items.length).toBe(1);
      expect(r.results.items[0]?.slug).toBe("squalane");
    });
  });
});

describe("searchProducts (advanced)", () => {
  it("builds include/exclude query and parses hits", async () => {
    const r = await client().searchProducts({
      query: "the ordinary",
      include: ["Squalane"],
      exclude: ["Simple Alcohols"],
      includeMode: "all",
    });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0]?.path).toMatch(/^\/products\//);
  });

  it("aggregates allPages (single page of results here)", async () => {
    const { c, urls } = makeClient();
    const r = await c.searchProducts(
      { query: "the ordinary", include: ["Squalane"] },
      { allPages: true },
    );
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.hasMore).toBe(false);
    expect(urls.length).toBe(1);
  });
});

describe("page param construction", () => {
  it("searchProducts page 3 requests ppage=3", async () => {
    const { c, urls } = makeClient();
    await c.searchProducts({ query: "the ordinary" }, { page: 3 });
    expect(urls[0]).toBe(
      "https://inkeedecoder.com/search/product?query=the+ordinary&ppage=3",
    );
  });

  it("getIngredientProducts page 3 requests uoffset=2", async () => {
    const { c, urls } = makeClient();
    await c.getIngredientProducts("tocopherol", { page: 3 });
    expect(urls[0]).toBe(
      "https://inkeedecoder.com/ingredients/tocopherol?uoffset=2",
    );
  });

  it("getBrand page 3 requests offset=2", async () => {
    const { c, urls } = makeClient();
    await c.getBrand("the-ordinary", { page: 3 });
    expect(urls[0]).toBe(
      "https://inkeedecoder.com/brands/the-ordinary?offset=2",
    );
  });

  it("getIngredientFunction page 3 requests offset=2", async () => {
    const { c, urls } = makeClient();
    await c.getIngredientFunction("emollient", { page: 3 });
    expect(urls[0]).toBe(
      "https://inkeedecoder.com/ingredient-functions/emollient?offset=2",
    );
  });
});

describe("maxPages cap", () => {
  it("stops following next links after maxPages fetches", async () => {
    // Every page (including the first) carries a next link, so the walk
    // only ends via the cap.
    const LOOP_HTML = `<html><body>
      <a class="simpletextlistitem" href="/products/loop-item">Loop Item</a>
      <a href="/search/product?query=loop&ppage=99">Next page &gt;&gt;</a>
    </body></html>`;
    const urls: string[] = [];
    const c = createInkeedecoderClient({
      baseUrl: BASE_URL,
      fetch: makeFetch([{ match: "", html: LOOP_HTML }], urls),
      requestIntervalMs: 0,
      maxPages: 2,
    });
    const r = await c.searchProducts({ query: "loop" }, { allPages: true });
    expect(urls.length).toBe(2);
    expect(r.hasMore).toBe(true);
    expect(r.nextPageUrl).toBeTruthy();
  });
});

describe("getBrand", () => {
  it("returns page 1 with an offset next link", async () => {
    const b = await client().getBrand("the-ordinary");
    expect(b.name).toBe("The Ordinary");
    expect(b.slug).toBe("the-ordinary");
    expect(b.path).toBe("/brands/the-ordinary");
    expect(b.products.items.length).toBe(50);
    expect(b.products.hasMore).toBe(true);
    expect(b.products.nextPageUrl).toMatch(/offset=1/);
  });

  it("aggregates all pages (page 2 empty)", async () => {
    const b = await client().getBrand("the-ordinary", { allPages: true });
    expect(b.products.items.length).toBe(50);
    expect(b.products.hasMore).toBe(false);
  });
});

describe("getIngredientFunction", () => {
  it("returns name, description, and paginated ingredients", async () => {
    const f = await client().getIngredientFunction("emollient");
    expect(f.name).toBe("emollient");
    expect(f.description).toMatch(/^Nice ingredients/);
    expect(f.ingredients.items.length).toBe(50);
    expect(f.ingredients.hasMore).toBe(true);
    expect(f.ingredients.nextPageUrl).toMatch(/offset=1/);
  });
});

describe("getIngredientProducts", () => {
  it("paginates the 'other products' list", async () => {
    const r = await client().getIngredientProducts("tocopherol");
    expect(r.products.items.length).toBeGreaterThan(20);
    expect(r.products.hasMore).toBe(true);
    expect(r.products.nextPageUrl).toMatch(/uoffset=1/);
    expect(r.knownAmountProducts).toBeUndefined();
  });

  it("includes the known-amount carousel when requested", async () => {
    const r = await client().getIngredientProducts("tocopherol", {
      includeKnownAmount: true,
    });
    expect(r.knownAmountProducts?.length).toBeGreaterThan(0);
    expect(r.knownAmountProducts?.[0]?.path).toMatch(/^\/products\//);
  });
});

describe("entity id formats", () => {
  it("getProduct accepts slug, path, and absolute URL ids", async () => {
    const bySlug = await client().getProduct(
      "the-ordinary-retinol-1-in-squalane",
    );
    const byPath = await client().getProduct(
      "/products/the-ordinary-retinol-1-in-squalane",
    );
    const byUrl = await client().getProduct(
      "https://inkeedecoder.com/products/the-ordinary-retinol-1-in-squalane",
    );
    expect(bySlug.slug).toBe("the-ordinary-retinol-1-in-squalane");
    expect(byPath.name).toBe(bySlug.name);
    expect(byUrl.path).toBe(byPath.path);
  });

  it("getIngredient accepts path and absolute URL ids", async () => {
    const byUrl = await client().getIngredient(
      "https://inkeedecoder.com/ingredients/squalane",
    );
    expect(byUrl.slug).toBe("squalane");
    expect(byUrl.path).toBe("/ingredients/squalane");
    expect(byUrl.name).toBe("Squalane");
  });
});

describe("createInkeedecoderClient guard", () => {
  it("throws when no fetch is available anywhere", () => {
    vi.stubGlobal("fetch", undefined);
    try {
      expect(() => createInkeedecoderClient({})).toThrow(/fetch/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("fetchHtml", () => {
  it("fetches arbitrary HTML", async () => {
    const html = await client().fetchHtml("/brands/the-ordinary");
    expect(html).toContain("The Ordinary products");
  });

  it("throws on non-ok responses", async () => {
    const c = createInkeedecoderClient({
      baseUrl: BASE_URL,
      fetch: (async () =>
        ({
          ok: false,
          status: 404,
          statusText: "Not Found",
          text: async () => "",
        }) as unknown as Response) as typeof fetch,
      requestIntervalMs: 0,
    });
    await expect(c.fetchHtml("/brands/missing")).rejects.toThrow(
      /404 Not Found/,
    );
  });
});
