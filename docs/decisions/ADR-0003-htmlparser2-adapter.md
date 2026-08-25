# ADR-0003: Replace cheerio with a direct htmlparser2/css-select adapter

- **Status:** Accepted
- **Date:** 2026-08-24
- **Supersedes:** the cheerio/slim portion of
  [ADR-0001](ADR-0001-rn-safe-dependency-strategy.md) (the injectable-fetch
  decision stands unchanged)

## Context

Socket's scan of `@knorby/inkeedecoder-client@0.1.0` flagged 13 dependency
alert types. Every one of them traced to cheerio's transitive tree —
`undici` (debug/env-var/filesystem access), `whatwg-encoding` (deprecated),
`encoding-sniffer` (typosquat heuristic), `safer-buffer` (unmaintained),
the `parse5` family — even though the library only ever imported
`cheerio/slim`, whose runtime path never touches those packages. npm installs
a package's full declared dependency set regardless of which export is used,
so consumers (and Socket) see the whole tree.

The adapter surface actually used from cheerio was small and enumerable:
`$()` overloads, `attr`, `text`, `each`, `first`, `last`, `eq`, `find`,
`children`, `contents`, `nextAll`, `addBack`, and `length`.

## Decision

Drop the `cheerio` dependency and depend directly on the packages that
cheerio/slim already wrapped: `htmlparser2` (parser), `css-select` (selector
engine), `domutils` (attribute/text helpers), `domhandler` (node types).
`src/html.ts` becomes the cheerio-style adapter implementing exactly the
API surface above; behavior parity is pinned by `tests/html.test.ts` plus
the offline fixture suite (which passes with zero fixture changes, because
htmlparser2 is the same parser slim used).

Residual informational alerts that persist in any selector-based stack are
acknowledged via `socket.yml` (`networkAccess` for domutils' dead RSS-feed
fetch reference, `trivialPackage` for boolbase, `minifiedFile` for entities'
generated tables, `gptAnomaly` for css-select, `urlStrings`) rather than
chased.

## Consequences

- Installed runtime tree shrinks from ~19 packages to 10 pure-JS packages;
  `parse5`, `undici`, `whatwg-*`, `encoding-sniffer`, and `safer-buffer`
  disappear entirely.
- The jQuery-like API is now maintained in-repo (~250 lines). New traversal
  semantics must be added to the adapter deliberately, with tests.
- Consumers who relied on receiving a real Cheerio object (none known — the
  public API only passes opaque `$` handles) would notice the type change;
  `Html`/`HtmlScope`/`HtmlSelection` are now exported instead.
- Metro/RN compatibility is unchanged: all four runtime dependencies are
  pure JavaScript with no Node builtins.
