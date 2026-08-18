/**
 * Public type definitions for @knorby/incidecoder-client.
 *
 * Every list item carries a `slug` (treated as the stable key for the entity on
 * incidecoder.com), the site-relative `path`, and the absolute `url`. Callers
 * that only need identifiers can ignore the verbose fields.
 */

/** INCIDecoder's editorial rating of a product/ingredient. */
export type OurTake = "superstar" | "goodie" | "icky";

/**
 * A generic cross-reference to another incidecoder.com entity (product,
 * ingredient, brand, or ingredient-function). `slug` is the stable key.
 */
export interface Ref {
  name: string;
  slug: string;
  path: string;
  url: string;
}

/** A product image. `webp`/`jpeg` are the 1x/2x/3x srcset URLs (when requested). */
export interface ProductImage {
  original: string;
  webp?: string[];
  jpeg?: string[];
}

/** A product hashtag ("#alcohol-free") and its human label. */
export interface Hashtag {
  tag: string;
  label: string;
}

/** A row of the "skim through" irritancy/comedogenicity table on a product. */
export interface SkimRow {
  ingredient: IngredientRef;
  functions: FunctionRef[];
  irritancy?: string;
  comedogenicity?: string;
  ourTake?: OurTake;
}

/** Ingredients grouped under an ingredient-function on a product page. */
export interface IngredientsByFunction {
  /** The function this group belongs to (e.g. "Antioxidant"). */
  function: FunctionRef;
  /** Ingredients in the group. */
  ingredients: IngredientRef[];
}

/** Compact per-ingredient data extracted from a product page's tooltip. */
export interface ProductTooltip {
  slug: string;
  functions: FunctionRef[];
  irritancy?: string;
  comedogenicity?: string;
  blurb?: string;
}

/** A per-ingredient long writeup ("Ingredients explained" section). */
export interface IngredientLongEntry {
  ingredient: IngredientRef;
  alsoCalled?: string;
  functions: FunctionRef[];
  ourTake?: OurTake;
  description?: string;
}

/** A reference to a product, with optional display metadata. */
export interface IngredientRef extends Ref {
  /** INCIDecoder editorial rating, when present. */
  ourTake?: OurTake;
  /** Declared active percentage (e.g. "1.0%"), when present on the link text. */
  percent?: string;
}

/** A reference to a brand. */
export interface BrandRef extends Ref {}

/** A reference to an ingredient-function (e.g. "emollient"). */
export interface FunctionRef extends Ref {}

/**
 * A product. Identity fields (`slug`, `name`, `path`, `url`) are always
 * returned; every other field is opt-in via {@link ProductQuery} flags and is
 * omitted from the output when its flag is off.
 */
export interface Product {
  slug: string;
  name: string;
  path: string;
  url: string;
  brand?: BrandRef;
  description?: string;
  ingredients?: IngredientRef[];
  images?: ProductImage;
  hashtags?: Hashtag[];
  fullName?: string;
  functions?: {
    key: IngredientsByFunction[];
    other: IngredientsByFunction[];
  };
  skimTable?: SkimRow[];
  dates?: {
    uploadedBy?: string;
    uploadedAt?: string;
    updatedAt?: string;
  };
  tooltips?: ProductTooltip[];
  longDescriptions?: IngredientLongEntry[];
}

/**
 * Options for {@link IncidecoderClient.getProduct}. Every field is an
 * independent boolean/mode; flags default to a lean output. Identity fields
 * (`slug`, `name`, `path`, `url`) are always present; every other section is
 * included only when its flag is on.
 */
export interface ProductQuery {
  /** Brand name + `/brands/` ref. Default `true`. */
  brand?: boolean;
  /** `#product-details` description text. Default `true`. */
  description?: boolean;
  /** Deduped ingredient set in INCI order (with `ourTake`/`percent`). Default `true`. */
  ingredients?: boolean;
  /** Image(s): `"none"` | `"original"` | `"all"` (all = webp/jpeg srcsets). Default `"original"`. */
  images?: "none" | "original" | "all";
  /** Hashtags (raw tag + human label). Default `true`. */
  hashtags?: boolean;
  /** Canonical "Brand Product" full name. Default `false`. */
  fullName?: boolean;
  /** Ingredients grouped by function (key + other). Default `false`. */
  functions?: boolean;
  /** Per-ingredient irritancy/comedogenicity/rating table. Default `false`. */
  skimTable?: boolean;
  /** Upload/last-updated dates. Default `false`. */
  dates?: boolean;
  /** Per-ingredient tooltip mini-data. Default `false`. */
  tooltips?: boolean;
  /** Per-ingredient long writeup text. Default `false`. */
  longDescriptions?: boolean;
}

/**
 * An ingredient. `slug`/`name`/`path`/`url` and `ourTake` (`null` when the
 * page carries no rating) are always returned; every other field is opt-in
 * via {@link IngredientQuery} flags and is omitted when its flag is off.
 */
export interface Ingredient {
  slug: string;
  name: string;
  path: string;
  url: string;
  ourTake: OurTake | null;
  functions?: FunctionRef[];
  alsoCalled?: string;
  image?: string;
  irritancy?: string;
  comedogenicity?: string;
  cosing?: {
    allFunctions?: string;
    cas?: string;
    ec?: string;
    iupacName?: string;
  };
  details?: string;
  proof?: string[];
}

/**
 * Options for {@link IncidecoderClient.getIngredient}. Granular flags;
 * identity fields plus `functions`/`safety`/`alsoCalled`/`image` default on.
 */
export interface IngredientQuery {
  /** What-it-does function refs. Default `true`. */
  functions?: boolean;
  /** Irritancy + comedogenicity. Default `true`. */
  safety?: boolean;
  /** Alias ("Also-called"). Default `true`. */
  alsoCalled?: boolean;
  /** Original image URL. Default `true`. */
  image?: boolean;
  /** CosIng data (CAS #, EC #, IUPAC name, official functions). Default `false`. */
  cosing?: boolean;
  /** Long-form writeup text. Default `false`. */
  details?: boolean;
  /** Reference list. Default `false`. */
  proof?: boolean;
}

/** A product shown in the "known amount" carousel on an ingredient page. */
export interface KnownAmountProductRef {
  name: string;
  slug: string;
  path: string;
  url: string;
  percent?: string;
  brand?: string;
  image?: string;
}

/**
 * A page of list results. `nextPageUrl` carries the authoritative next-page
 * link extracted from the HTML (robust across pagination schemes).
 */
export interface Paginated<T> {
  items: T[];
  /** 1-based page number of the current page. */
  page: number;
  hasMore: boolean;
  /** Absolute next-page URL, present when `hasMore` is true. */
  nextPageUrl?: string;
}

/** Options shared by list (paginated) methods. */
export interface ListQuery {
  /** Fetch a specific 1-based page (default `1`). */
  page?: number;
  /** Follow next-page links and merge all results (subject to client `maxPages`). */
  allPages?: boolean;
}

/** Which `/search` results tab to fetch: products or ingredients. */
export type SearchTab = "products" | "ingredients";

/**
 * Options for {@link IncidecoderClient.search}: {@link ListQuery} plus a
 * single-tab selector.
 */
export interface SearchQuery extends ListQuery {
  /**
   * Fetch only this tab. A tabbed search costs one request at any page — the
   * combined (both-tabs) result needs two separate requests at `page >= 2` —
   * and `{ allPages: true }` walks only this tab. When set, the result is a
   * {@link SearchTabResult} instead of a {@link SearchResult}.
   */
  tab?: SearchTab;
}

/** `search()` results. Both tabs are returned; each paginates independently. */
export interface SearchResult {
  query: string;
  products: Paginated<Ref>;
  ingredients: Paginated<Ref>;
}

/** `search()` result when `opts.tab` is set: the chosen tab's page of results. */
export interface SearchTabResult {
  query: string;
  /** The tab these results came from. */
  tab: SearchTab;
  results: Paginated<Ref>;
}

/** `searchProducts()` results (advanced include/exclude filter). */
export type ProductSearchResult = Paginated<Ref>;

/** A brand and its product list (paginated). */
export interface Brand {
  slug: string;
  name: string;
  path: string;
  url: string;
  products: Paginated<Ref>;
}

/** An ingredient-function page and its ingredient list (paginated). */
export interface IngredientFunction {
  slug: string;
  name: string;
  path: string;
  url: string;
  description?: string;
  ingredients: Paginated<Ref>;
}

/** `getIngredientProducts()` result. */
export interface IngredientProductsResult {
  products: Paginated<Ref>;
  /** Known-amount carousel (page 1 only), when `includeKnownAmount` is set. */
  knownAmountProducts?: KnownAmountProductRef[];
}

/** Advanced product search filters. `include`/`exclude` use site display names. */
export interface ProductSearchFilters {
  query: string;
  /** Ingredients the product must contain (site display names, e.g. "Squalane"). */
  include?: string[];
  /** Ingredients the product must not contain. */
  exclude?: string[];
  /** `all` = ALL OF include (default); `any` = ANY OF. */
  includeMode?: "all" | "any";
}

/** Constructor options for the client. */
export interface ClientOptions {
  /** Base URL. Default `https://incidecoder.com`. */
  baseUrl?: string;
  /** Custom `fetch` (e.g. a cached/proxied implementation). Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
  /** Extra request headers (e.g. a custom User-Agent). */
  headers?: Record<string, string>;
  /** Politeness delay (ms) between requests during auto-pagination. Default `1000`. */
  requestIntervalMs?: number;
  /** Safety cap on pages fetched per `allPages` operation. Default `25`. */
  maxPages?: number;
}

/** The client returned by {@link createIncidecoderClient}. */
export interface IncidecoderClient {
  /** Fetch raw HTML for any incidecoder.com path/URL. */
  fetchHtml(target: string): Promise<string>;
  /**
   * Simple search; returns both products and ingredients tabs. Page 1 is a
   * single combined request; `{ page: 2 }`+ fetches each tab separately
   * (`activetab` + `ppage`); `{ allPages }` walks both tabs from page 1.
   */
  search(
    query: string,
    opts?: SearchQuery & { tab?: undefined },
  ): Promise<SearchResult>;
  /**
   * Single-tab search (`{ tab: "products" | "ingredients" }`): exactly one
   * request at any page — half the cost of the combined result at `page >= 2`
   * — and `{ allPages }` walks only the chosen tab. Returns the tab's items
   * under `results`.
   */
  search(
    query: string,
    opts: SearchQuery & { tab: SearchTab },
  ): Promise<SearchTabResult>;
  /** Advanced product search with ingredient include/exclude filters. */
  searchProducts(
    filters: ProductSearchFilters,
    opts?: ListQuery,
  ): Promise<ProductSearchResult>;
  /** Fetch and parse a product page. */
  getProduct(id: string, opts?: ProductQuery): Promise<Product>;
  /** Fetch and parse an ingredient page. */
  getIngredient(id: string, opts?: IngredientQuery): Promise<Ingredient>;
  /** Fetch products that contain an ingredient (paginated; `uoffset`). */
  getIngredientProducts(
    id: string,
    opts?: ListQuery & { includeKnownAmount?: boolean },
  ): Promise<IngredientProductsResult>;
  /** Fetch a brand's product list (paginated; `offset`). */
  getBrand(id: string, opts?: ListQuery): Promise<Brand>;
  /** Fetch an ingredient-function's ingredient list (paginated; `offset`). */
  getIngredientFunction(
    id: string,
    opts?: ListQuery,
  ): Promise<IngredientFunction>;
}
