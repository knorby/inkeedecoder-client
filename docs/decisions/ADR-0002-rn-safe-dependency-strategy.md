# ADR-0002: React-Native-safe dependency strategy (cheerio/slim + injectable fetch)

- **Status:** Accepted
- **Date:** 2026-08-16

## Context

The library targets React Native (Metro/Hermes) among other JS runtimes. The
two runtime-sensitive choices are the HTML parser and the HTTP layer:

- Full `cheerio` (v1.x) imports `undici` for its `fromURL` static method. Under
  Metro this `undici` import fails to resolve and breaks bundling.
- `fetch` is global in Node 20+, RN, and browsers, but relying on a global
  makes the library untestable and non-portable in environments that use a
  custom/proxied fetch.

## Decision

- Import cheerio **only** from `cheerio/slim` (the htmlparser2-only export),
  and only inside a single wrapper module, `src/html.ts`. Slim excludes `parse5`
  and `undici`. Type-only imports (`BasicAcceptedElems` from cheerio,
  `AnyNode` from `domhandler`) are erased at compile time.
- Make `fetch` injectable via `createIncidecoderClient({ fetch })`, defaulting
  to `globalThis.fetch`. All HTTP goes through this single injected function.
- Use no Node.js-only APIs (`fs`, `Buffer`, `stream`, Node's `url`). URL
  building/parsing uses tiny string helpers in `src/util/refs.ts`.

## Alternatives considered

- `cheerio-no-node-native` / `htmlparser2-without-node-native` forks — stale
  (last published 2017/2023). Rejected.
- `node-html-parser` — viable fallback, but cheerio/slim is sufficient and we
  prefer one parser surface area.
- Importing full cheerio and aliasing `undici` in consumer Metro config —
  pushes the burden onto every RN consumer. Rejected in favor of slim.

## Consequences

- The parser engine is htmlparser2 (lenient, fast) rather than the
  spec-compliant parse5. INCIDecoder's server-rendered HTML parses cleanly under
  htmlparser2; if any page ever needs stricter parsing, the swap is localized to
  `src/html.ts`.
- Confirmed in the build output: the emitted bundle contains no `undici`,
  `fromURL`, or `parse5` references.
