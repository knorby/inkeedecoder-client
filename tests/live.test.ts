import { describe, expect, it } from "vitest";
import { createIncidecoderClient } from "../src/client.js";

const LIVE = process.env.INCIDECODER_LIVE === "1";

const client = createIncidecoderClient({
  requestIntervalMs: 600,
  maxPages: 3,
});

// These tests hit the live site. They assert that the core extraction contracts
// still hold — failures flag that incidecoder.com's markup has changed in a
// way the parsers don't handle. They are skipped unless INCIDECODER_LIVE=1.
describe.skipIf(!LIVE)("live incidecoder.com", () => {
  it("parses a real product page", async () => {
    const p = await client.getProduct("the-ordinary-retinol-1-in-squalane", {
      functions: true,
      skimTable: true,
      dates: true,
    });
    expect(p.slug).toBe("the-ordinary-retinol-1-in-squalane");
    expect(p.brand?.slug).toBe("the-ordinary");
    expect(p.ingredients?.length).toBeGreaterThan(3);
    expect(p.ingredients?.some((i) => i.ourTake === "superstar")).toBe(true);
  });

  it("parses a real ingredient page", async () => {
    const ing = await client.getIngredient("squalane", {
      cosing: true,
      details: true,
      proof: true,
    });
    expect(ing.slug).toBe("squalane");
    expect(ing.functions?.length).toBeGreaterThan(0);
    expect(ing.cosing?.cas).toBeTruthy();
    expect(ing.details?.length).toBeGreaterThan(50);
  });

  it("runs a real search", async () => {
    const r = await client.search("the ordinary");
    expect(r.query).toBe("the ordinary");
    expect(r.products.items.length).toBeGreaterThan(0);
  });

  it("runs a real single-tab search", async () => {
    const r = await client.search("the ordinary", { tab: "products" });
    expect(r.tab).toBe("products");
    expect(r.results.items.length).toBeGreaterThan(0);
    expect(r.results.items[0]?.path).toMatch(/^\/products\//);
  });

  it("lists a real brand's products", async () => {
    const b = await client.getBrand("the-ordinary");
    expect(b.name).toBe("The Ordinary");
    expect(b.products.items.length).toBeGreaterThan(0);
  });

  it("lists a real ingredient-function's ingredients", async () => {
    const f = await client.getIngredientFunction("emollient");
    expect(f.name).toBe("emollient");
    expect(f.ingredients.items.length).toBeGreaterThan(0);
  });
});
