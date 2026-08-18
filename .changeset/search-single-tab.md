---
"@knorby/incidecoder-client": minor
---

- `search()` now accepts `{ tab: "products" | "ingredients" }` to fetch a
  single tab in exactly one request at any page — half the cost of the
  both-tabs result at `page >= 2` (which needs one request per tab). A tabbed
  call returns `{ query, tab, results }`, and `{ allPages: true }` walks only
  the chosen tab.
- New exported types: `SearchTab`, `SearchQuery`, `SearchTabResult`.
- README: prominent warning that `searchProducts` `include`/`exclude` use the
  site's display names (not INCI names), and a documented limitation that the
  site publishes no UPC/barcode data.
