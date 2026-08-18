# @knorby/inkeedecoder-client

A universal TypeScript client for scraping data from
[inkeedecoder.com](https://inkeedecoder.com/) — products, ingredients, search
(simple + advanced), brands, and ingredient functions.

- **Universal runtime.** No Node.js-only APIs. HTTP runs through an injectable
  `fetch` (native in Node 20+, React Native, and browsers). HTML parsing uses
  [`cheerio/slim`](https://cheerio.js.org/docs/intro) (excludes `parse5` and
  `undici`), so the library bundles cleanly under React Native / Metro where
  full cheerio's `fromURL` import breaks bundling.
- **Parse/transport split.** Every `parse*` function is a pure
  `(html) => data` export, so you can pair it with any prefetch/cache layer. The
  `createInkeedecoderClient()` convenience wrapper fetches + parses for you.
- **Options everywhere.** Every object-returning method takes granular flags so
  lean output is the default and verbose sections (functions, skim table,
  CosIng data, long-form descriptions, …) are opt-in.
- **Next-link pagination.** The authoritative "Next page >>" URL is read from
  the HTML rather than reconstructed, so the library is robust across
  inkeedecoder.com's differing param schemes (`ppage`, `uoffset`, `offset`).

> **Not affiliated with inkeedecoder.com.** This is an unofficial scraper. The
> site's `robots.txt` permits crawling `/products`, `/ingredients`,
> `/search`, `/brands`, and `/ingredient-functions` (it disallows only `/auth/`
> and `/products/recommend/`). Be polite: keep request volume low, use the
> client's `requestIntervalMs` for auto-pagination, don't republish the site's
> prose, and prefer the lean option flags when you don't need verbose data.

## Install

```bash
npm install @knorby/inkeedecoder-client
```

### React Native

The library is Metro-safe out of the box (no `undici`/`parse5` in the bundle).
`fetch` is injected, so in environments without a global `fetch` pass one:

```ts
import { createInkeedecoderClient } from "@knorby/inkeedecoder-client";

const client = createInkeedecoderClient({
  // fetch: myFetch,            // optional; defaults to globalThis.fetch
  requestIntervalMs: 1000,      // politeness delay for auto-pagination
  maxPages: 25,                 // safety cap per allPages operation
});
```

## Quick start

```ts
const client = createInkeedecoderClient();

// Lean product (defaults): name, brand, description, ingredient set, original
// image, hashtags.
const product = await client.getProduct("the-ordinary-retinol-1-in-squalane");
console.log(product.name, product.brand?.name, product.ingredients.length);

// Verbose product: opt into each section independently.
const full = await client.getProduct("the-ordinary-retinol-1-in-squalane", {
  images: "all",
  functions: true,
  skimTable: true,
  dates: true,
  tooltips: true,
  longDescriptions: true,
});

// Ingredient page.
const squalane = await client.getIngredient("squalane", {
  cosing: true,
  details: true,
  proof: true,
});

// Search (both products + ingredients tabs; each paginates independently).
const results = await client.search("the ordinary");
console.log(results.products.items.length, results.products.hasMore);

// ...or fetch every page of both tabs:
const all = await client.search("the ordinary", { allPages: true });

// ...or fetch a single tab — exactly one request at any page (the both-tabs
// form costs two requests from page 2 on):
const productsOnly = await client.search("the ordinary", {
  tab: "products",
  page: 3,
});

// Advanced product search (include/exclude use the site's display names —
// see the warning under "Methods").
const hits = await client.searchProducts({
  query: "the ordinary",
  include: ["Squalane"],
  exclude: ["Simple Alcohols"],
  includeMode: "all", // 'all' = ALL OF (default); 'any' = ANY OF
});
```

## API

### `createInkeedecoderClient(options)`

| Option             | Default                          | Description                                            |
| ------------------ | -------------------------------- | ------------------------------------------------------ |
| `baseUrl`          | `https://inkeedecoder.com`        | Base URL.                                              |
| `fetch`            | `globalThis.fetch`               | Custom `fetch` (cached/proxied/RN).                    |
| `headers`          | `{ User-Agent: … }`             | Extra request headers.                                 |
| `requestIntervalMs` | `1000`                          | Delay between requests during auto-pagination.        |
| `maxPages`         | `25`                             | Safety cap on pages fetched per `allPages` operation. |

### Methods

Flag semantics: identity fields (`slug`/`name`/`path`/`url`) are always
returned; every other section is included only when its flag is on — a flag
turned off omits the key entirely (no empty placeholders).

- `search(query, opts?)` → both products + ingredients tabs. Page 1 is one
  combined request; `{ page: 2 }`+ fetches each tab separately (`activetab` +
  `ppage`); `{ allPages }` follows each tab's next links from page 1.
  `{ tab: "products" | "ingredients" }` selects a single tab: exactly one
  request at any page — half the cost of the both-tabs form at `page ≥ 2` —
  and `allPages` walks only that tab. A tabbed call returns
  `{ query, tab, results }` instead of `{ query, products, ingredients }`.
- `searchProducts(filters, opts?)` → advanced search (include/exclude);
  `{ page }` (uses `ppage`) and `{ allPages }`.
- `getProduct(id, opts?)` → `id` is a slug, path, or URL. Flags (defaults in
  **bold**): `brand` **true**, `description` **true**, `ingredients` **true**,
  `images` **`"original"`** (`"none"` | `"original"` | `"all"`), `hashtags`
  **true**, `fullName` false, `functions` false, `skimTable` false, `dates`
  false, `tooltips` false, `longDescriptions` false.
- `getIngredient(id, opts?)` → `ourTake` is always present (`null` when the
  page has no rating). Flags: `functions` **true**, `safety`
  (irritancy + comedogenicity) **true**, `alsoCalled` **true**, `image`
  **true**, `cosing` false, `details` false, `proof` false.
- `getIngredientProducts(id, opts?)` → paginated "other products" list
  (`uoffset`); `{ includeKnownAmount: true }` adds the known-amount carousel.
- `getBrand(id, opts?)` → brand product list (`offset`); `{ page }` /
  `{ allPages }`.
- `getIngredientFunction(id, opts?)` → ingredient-function ingredient list
  (`offset`); `{ page }` / `{ allPages }`.
- `fetchHtml(target)` → raw HTML for any path/URL.

Every list item is a `{ name, slug, path, url }` ref — the `slug` is the stable
key for the entity on inkeedecoder.com.

> **⚠️ Easy trap: `searchProducts` filters use the site's display names, not
> INCI names.** `include`/`exclude` must match the ingredient names
> inkeedecoder.com itself uses in its advanced-search UI — e.g. `"Squalane"` or
> group entries like `"Simple Alcohols"`, which have no INCI equivalent. A
> formal INCI name can silently match nothing. The `name` on any ingredient
> ref returned by this client is a reliable source of valid values (as is the
> ingredient's page title on the site).

## Limitations

- **No UPC/barcode lookup.** inkeedecoder.com does not publish UPC/EAN/barcode
  identifiers anywhere (verified across product pages and search), so there is
  nothing to scrape. Match products by `slug` or `name` instead.

### Pure parsers (no fetch)

For custom transport layers (RN prefetch, edge caches, raw HTML you already
have), import the `parse*` functions directly:

```ts
import { parseProductPage, parseIngredientPage, parseSearchPage } from "@knorby/inkeedecoder-client";

const product = parseProductPage(htmlString, "https://inkeedecoder.com");
```

Also exported: `parseIngredientProductsPage`, `parseSearchProductsPage`,
`parseBrandPage`, `parseIngredientFunctionPage`, `parseHtml`, `findNextLink`,
`makePaginated`, `paginateAll`, and the text/URL utilities.

## Testing

| Command               | What it does                                                         |
| --------------------- | -------------------------------------------------------------------- |
| `npm test`            | Offline fixture-based unit + client tests (no network).             |
| `npm run test:live`   | Hits the live site (`INKEEDECODER_LIVE=1`) — a markup-change tripwire. |
| `npm run test:coverage` | Coverage report.                                                  |

Fixtures live in `tests/fixtures/` and are (re)captured with
`node scripts/capture-fixtures.mjs`. The CI workflow runs only the offline
suite.

## Development

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `npm run build`      | Build (tsup — dual ESM/CJS + `.d.ts`/`.d.cts`).                      |
| `npm run lint`       | Lint with Biome.                                                      |
| `npm run check`      | Lint + format in one pass (writes changes).                          |
| `npm run typecheck`  | Type-check `src/` + `tests/` with `tsc` (no emit).                    |
| `npx changeset`      | Create a changeset (required for any change that affects published output). |

See [AGENTS.md](AGENTS.md) for AI-agent steering and [CONTRIBUTING.md](CONTRIBUTING.md)
for the full development workflow.

## License

[Apache-2.0](LICENSE) — Copyright 2026 knorby.
