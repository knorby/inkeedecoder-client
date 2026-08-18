# ADR-0003: Parse/transport split and next-link-driven pagination

- **Status:** Accepted
- **Date:** 2026-08-16

## Context

INKEEDecoder paginates with a *different* param scheme per page type:

| Page type               | Param           |
| ----------------------- | --------------- |
| Search products/ingredients | `ppage` (with `activetab`) |
| Ingredient → "other products" | `uoffset`  |
| Brand product list      | `offset`        |
| Ingredient-function list | `offset`       |

Constructing these URLs is fragile (the scheme has no documented contract and
could change). Separately, callers may want to use their own transport layer
(prefetch, edge cache, raw HTML they already have).

## Decision

- **Pure parsers.** Every `parse*` in `src/parse/` is a
  `(html, baseUrl) => data` function with no I/O. They are exported so callers
  can pair them with any fetch implementation.
- **Client = fetch + parse + paginate + project.** `src/client.ts` is the only
  place that does I/O, pagination orchestration, and option projection. It
  contains no CSS selectors.
- **Next-link driven pagination.** List parsers extract the authoritative
  "Next page >>" URL from the HTML via `findNextLink`, and `paginateAll`
  follows those links. The client never constructs `ppage`/`uoffset`/`offset`
  itself. (`page` fetching for single-list types constructs the known param, but
  all-page-walking is link-driven and robust.)

## Consequences

- Adding a new page type is: write a parser; add a client method that fetches +
  parses + paginates. No selector knowledge leaks into the client.
- If INKEEDecoder renames a pagination param, the next-link extraction keeps
  working without code changes.
- Parallel/`allPages` aggregation is centralized in `paginateAll`, which
  enforces `maxPages` + `requestIntervalMs` politeness for every list method.
