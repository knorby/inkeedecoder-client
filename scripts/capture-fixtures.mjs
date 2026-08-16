// Dev utility: (re)captures live incidecoder.com HTML into tests/fixtures/*.html
// so the fixture-based unit tests stay offline + deterministic. Run with:
//   node scripts/capture-fixtures.mjs
// The captured pages double as a site-change tripwire; refresh when updating
// expected assertions.
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "..", "tests", "fixtures");

const BASE = "https://incidecoder.com";
const UA =
  "@knorby/incidecoder-client/0 (capture-fixtures; +https://github.com/knorby/incidecoder-client)";

const PAGES = [
  ["product-the-ordinary-retinol-1-in-squalane.html", "/products/the-ordinary-retinol-1-in-squalane"],
  ["ingredient-squalane.html", "/ingredients/squalane"],
  ["ingredient-tocopherol.html", "/ingredients/tocopherol"],
  ["search-the-ordinary.html", "/search?query=the+ordinary"],
  ["search-squalane.html", "/search?query=squalane"],
  ["search-squalane-products-page2.html", "/search?query=squalane&activetab=products&ppage=2"],
  ["search-products-advanced.html", "/search/product?query=the+ordinary&include=Squalane"],
  ["brand-the-ordinary.html", "/brands/the-ordinary"],
  ["ingredient-function-emollient.html", "/ingredient-functions/emollient"],
];

async function main() {
  await mkdir(FIXTURES, { recursive: true });
  for (const [file, path] of PAGES) {
    const url = BASE + path;
    process.stdout.write(`fetching ${path} ... `);
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      console.log(`FAILED ${res.status} ${res.statusText}`);
      continue;
    }
    const html = await res.text();
    await writeFile(join(FIXTURES, file), html, "utf8");
    console.log(`ok (${html.length} bytes) -> tests/fixtures/${file}`);
    // Be polite between captures.
    await new Promise((r) => setTimeout(r, 750));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
