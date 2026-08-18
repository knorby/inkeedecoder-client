/**
 * @knorby/inkeedecoder-client
 *
 * A universal TypeScript client for scraping data from inkeedecoder.com —
 * products, ingredients, search (simple + advanced), brands, and ingredient
 * functions. No Node.js-only APIs: HTTP runs through an injectable `fetch`
 * (native in Node 20+, React Native, and browsers) and HTML parsing uses
 * `cheerio/slim` (React-Native/Metro-safe).
 *
 * Not affiliated with inkeedecoder.com. Be polite: keep request volume low,
 * use the client's `requestIntervalMs` for auto-pagination, and don't
 * republish the site's prose. See README for etiquette + robots notes.
 */
import { createInkeedecoderClient } from "./client.js";

export { createInkeedecoderClient } from "./client.js";
export { parseHtml } from "./html.js";
export { findNextLink, makePaginated, paginateAll } from "./pagination.js";
export {
  parseIngredientPage,
  parseIngredientProductsPage,
} from "./parse/ingredient.js";
export {
  parseBrandPage,
  parseIngredientFunctionPage,
  parseSearchPage,
  parseSearchProductsPage,
} from "./parse/lists.js";
export { parseProductPage } from "./parse/product.js";
export type {
  Brand,
  BrandRef,
  ClientOptions,
  FunctionRef,
  Hashtag,
  InkeedecoderClient,
  Ingredient,
  IngredientFunction,
  IngredientLongEntry,
  IngredientProductsResult,
  IngredientQuery,
  IngredientRef,
  KnownAmountProductRef,
  ListQuery,
  OurTake,
  Paginated,
  Product,
  ProductImage,
  ProductQuery,
  ProductSearchFilters,
  ProductSearchResult,
  ProductTooltip,
  Ref,
  SearchQuery,
  SearchResult,
  SearchTab,
  SearchTabResult,
  SkimRow,
} from "./types.js";
export {
  isAbsoluteUrl,
  joinUrl,
  normalizeEntityId,
  parsePath,
  slugFromPath,
} from "./util/refs.js";
export {
  extractPercent,
  normalizeText,
  ourTakeFromClass,
  ourTakeFromText,
  stripQuotes,
} from "./util/text.js";

export { createInkeedecoderClient as default };
