---
"@knorby/inkeedecoder-client": minor
---

Replace cheerio with a direct htmlparser2/css-select adapter.

HTML parsing now goes through a small cheerio-style adapter in `src/html.ts`
over `htmlparser2` + `css-select` + `domutils` + `domhandler` — the same
parser and selector stack cheerio's slim build wraps, minus cheerio itself.
Parsed output is identical (the offline fixture suite passes unchanged), the
bundle stays React Native/Metro-safe, and the installed dependency tree drops
from ~19 packages to 10 pure-JS packages, removing `parse5`, `undici`,
`whatwg-*`, `encoding-sniffer`, and `safer-buffer` entirely. Residual
informational Socket alerts are acknowledged in `socket.yml`. Public types:
`Html`/`HtmlScope`/`HtmlSelection` replace the cheerio types.
