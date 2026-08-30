# Changelog

## 0.2.0

### Minor Changes

- 5d7f9ee: Replace cheerio with a direct htmlparser2/css-select adapter.
  
  HTML parsing now goes through a small cheerio-style adapter in `src/html.ts`
  over `htmlparser2` + `css-select` + `domutils` + `domhandler` — the same
  parser and selector stack cheerio's slim build wraps, minus cheerio itself.
  Parsed output is identical (the offline fixture suite passes unchanged), the
  bundle stays React Native/Metro-safe, and the installed dependency tree drops
  from ~19 packages to 10 pure-JS packages, removing `parse5`, `undici`,
  `whatwg-*`, `encoding-sniffer`, and `safer-buffer` entirely. Residual
  informational Socket alerts are acknowledged in `socket.yml`. Public types:
  `Html`/`HtmlScope`/`HtmlSelection` replace the cheerio types.

## 0.1.0

### Minor Changes

- f2d652e: Initial release. Universal TypeScript scraper client for inkeedecoder.com:
  
  - `createInkeedecoderClient` with injectable `fetch` (React Native / Metro safe).
  - Methods: `search`, `searchProducts` (advanced include/exclude), `getProduct`,
    `getIngredient`, `getIngredientProducts`, `getBrand`, `getIngredientFunction`,
    `fetchHtml`.
  - Pure `parse*` exports for custom transport layers.
  - Granular option flags with lean defaults (no preset levels).
  - Next-link-driven pagination (`allPages`) across `ppage`/`uoffset`/`offset`.
  - Offline fixture tests + env-gated live tests.
- 9f5086f: - `search()` now accepts `{ tab: "products" | "ingredients" }` to fetch a
    single tab in exactly one request at any page — half the cost of the
    both-tabs result at `page >= 2` (which needs one request per tab). A tabbed
    call returns `{ query, tab, results }`, and `{ allPages: true }` walks only
    the chosen tab.
  - New exported types: `SearchTab`, `SearchQuery`, `SearchTabResult`.
  - README: prominent warning that `searchProducts` `include`/`exclude` use the
    site's display names (not INCI names), and a documented limitation that the
    site publishes no UPC/barcode data.

<!-- Changesets generates entries below this line. Do not edit manually. -->
