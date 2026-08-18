import { describe, expect, it } from "vitest";
import { parseProductPage } from "../src/parse/product.js";
import { BASE_URL, fixture } from "./helpers.js";

const product = parseProductPage(
  fixture("product-the-ordinary-retinol-1-in-squalane.html"),
  BASE_URL,
);

describe("parseProductPage — the ordinary retinol 1% in squalane", () => {
  it("extracts the canonical slug/name/identity", () => {
    expect(product.slug).toBe("the-ordinary-retinol-1-in-squalane");
    expect(product.name).toBe("Retinol 1% In Squalane");
    expect(product.path).toBe("/products/the-ordinary-retinol-1-in-squalane");
    expect(product.url).toBe(
      "https://inkeedecoder.com/products/the-ordinary-retinol-1-in-squalane",
    );
  });

  it("extracts the brand ref", () => {
    expect(product.brand).toBeDefined();
    expect(product.brand?.name).toBe("The Ordinary");
    expect(product.brand?.slug).toBe("the-ordinary");
    expect(product.brand?.path).toBe("/brands/the-ordinary");
  });

  it("strips surrounding quotes from the description", () => {
    expect(product.description).toMatch(/^This water-free solution/);
    expect(product.description).not.toMatch(/^"/);
  });

  it("returns the deduped ingredient set in INCI order", () => {
    const slugs = product.ingredients?.map((i) => i.slug) ?? [];
    expect(slugs).toEqual([
      "squalane",
      "caprylic-capric-triglyceride",
      "simmondsia-chinensis-seed-oil",
      "retinol",
      "solanum-lycopersicum-fruit-extract",
      "rosmarinus-officinalis-leaf-extract",
      "hydroxymethoxyphenyl-decanone",
      "bht",
    ]);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("normalizes zero-width characters out of ingredient names", () => {
    const caprylic = product.ingredients?.find(
      (i) => i.slug === "caprylic-capric-triglyceride",
    );
    expect(caprylic?.name).toBe("Caprylic/Capric Triglyceride");
    expect(caprylic?.name).not.toMatch(/\u200b/);
  });

  it("captures our-take ratings and percentages", () => {
    const retinol = product.ingredients?.find((i) => i.slug === "retinol");
    expect(retinol?.ourTake).toBe("superstar");
    expect(retinol?.percent).toBe("1.0");
    expect(retinol?.name).toBe("Retinol 1.0%");

    const squalane = product.ingredients?.find((i) => i.slug === "squalane");
    expect(squalane?.ourTake).toBe("goodie");

    const bht = product.ingredients?.find((i) => i.slug === "bht");
    expect(bht?.ourTake).toBeUndefined();
  });

  it("extracts images (original + srcsets)", () => {
    expect(product.images).toBeDefined();
    expect(product.images?.original).toMatch(/front_photo_original\.jpeg$/);
    expect(product.images?.webp?.length).toBe(3);
    expect(product.images?.jpeg?.length).toBe(3);
  });

  it("extracts hashtags with human labels", () => {
    expect(product.hashtags).toBeDefined();
    expect(product.hashtags?.map((h) => h.tag)).toContain("#alcohol-free");
    const known = product.hashtags?.find(
      (h) => h.tag === "#knownamountofactive",
    );
    expect(known?.label).toBe("Retinol: 1.0%");
  });

  it("extracts the canonical full name", () => {
    expect(product.fullName).toBe("The Ordinary Retinol 1% In Squalane");
  });

  it("groups key/other ingredients by function", () => {
    expect(product.functions).toBeDefined();
    expect(product.functions?.key.length).toBe(4);
    expect(product.functions?.other.length).toBe(4);
    const keyFnNames = product.functions?.key.map((g) => g.function.name);
    expect(keyFnNames).toContain("Antioxidant");
    expect(keyFnNames).toContain("Cell-communicating ingredient");
    const emollient = product.functions?.other.find(
      (g) => g.function.slug === "emollient",
    );
    expect(emollient?.ingredients.map((i) => i.slug)).toContain("squalane");
  });

  it("builds the skim-through table", () => {
    expect(product.skimTable).toBeDefined();
    expect(product.skimTable?.length).toBe(8);
    const retinol = product.skimTable?.find(
      (r) => r.ingredient.slug === "retinol",
    );
    expect(retinol?.ourTake).toBe("superstar");
    expect(retinol?.functions.map((f) => f.slug)).toContain(
      "cell-communicating-ingredient",
    );
    const squalane = product.skimTable?.find(
      (r) => r.ingredient.slug === "squalane",
    );
    expect(squalane?.irritancy).toBe("0");
    expect(squalane?.comedogenicity).toBe("1");
  });

  it("extracts upload/update dates and uploader", () => {
    expect(product.dates).toBeDefined();
    expect(product.dates?.uploadedBy).toBe("andreas");
    expect(product.dates?.uploadedAt).toBe("2018-03-16");
    expect(product.dates?.updatedAt).toBe("2020-02-10");
  });

  it("extracts per-ingredient tooltip mini-data", () => {
    expect(product.tooltips).toBeDefined();
    expect(product.tooltips?.length).toBe(8);
    const sq = product.tooltips?.find((t) => t.slug === "squalane");
    expect(sq?.functions.map((f) => f.slug)).toContain("emollient");
    expect(sq?.irritancy).toBe("0");
    expect(sq?.comedogenicity).toBe("1");
  });

  it("extracts per-ingredient long writeups", () => {
    expect(product.longDescriptions).toBeDefined();
    expect(product.longDescriptions?.length).toBe(8);
    const retinol = product.longDescriptions?.find(
      (e) => e.ingredient.slug === "retinol",
    );
    expect(retinol?.ourTake).toBe("superstar");
    expect(retinol?.functions.map((f) => f.slug)).toContain(
      "cell-communicating-ingredient",
    );
    expect(retinol?.description?.length).toBeGreaterThan(100);
  });
});
