---
"@knorby/inkeedecoder-client": minor
---

Request control: pacing, timeouts, and cancellation.

- `requestIntervalMs` now spaces **every** request the client makes — searches,
  lookups, and pagination walks alike — through a scheduler shared by the
  client instance. Previously it only delayed requests inside `allPages`
  walks, so rapid sequential calls hit the site unpaced. Lower it (or set `0`)
  when talking to a mirror or fixtures.
- New `timeoutMs` option (default `30000`, `0` disables): a request that takes
  longer is aborted and rejects with `Request to <url> timed out after <n> ms`.
  The timeout counts from when the request starts; the spacing-queue wait
  beforehand doesn't count against it.
- Every method's options object now accepts `signal` to cancel that call;
  `fetchHtml(target, signal?)` takes one too. Aborted requests reject with an
  `AbortError` — promptly, even while still waiting in the spacing queue — and
  a caller abort is reported as such even if the timeout fires meanwhile.
- `paginateAll`'s `delayMs` option is now optional (the client still passes its
  interval, so behavior is unchanged); the client's scheduler means pacing no
  longer depends on it.
