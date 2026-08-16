---
"@knorby/incidecoder-client": minor
---

Initial release. Universal TypeScript scraper client for incidecoder.com:

- `createIncidecoderClient` with injectable `fetch` (React Native / Metro safe).
- Methods: `search`, `searchProducts` (advanced include/exclude), `getProduct`,
  `getIngredient`, `getIngredientProducts`, `getBrand`, `getIngredientFunction`,
  `fetchHtml`.
- Pure `parse*` exports for custom transport layers.
- Granular option flags with lean defaults (no preset levels).
- Next-link-driven pagination (`allPages`) across `ppage`/`uoffset`/`offset`.
- Offline fixture tests + env-gated live tests.
