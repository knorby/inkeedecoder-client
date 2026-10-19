import { describe, expect, it } from "vitest";
import {
  parseIngredientPage,
  parseIngredientProductsPage,
} from "../src/parse/ingredient.js";
import { BASE_URL, fixture } from "./helpers.js";

const squalane = parseIngredientPage(
  fixture("ingredient-squalane.html"),
  BASE_URL,
);
const tocopherol = parseIngredientPage(
  fixture("ingredient-tocopherol.html"),
  BASE_URL,
);

describe("parseIngredientPage — squalane", () => {
  it("reads identity from the #global JSON", () => {
    expect(squalane.slug).toBe("squalane");
    expect(squalane.name).toBe("Squalane");
    expect(squalane.path).toBe("/ingredients/squalane");
  });

  it("extracts our-take", () => {
    expect(squalane.ourTake).toBe("goodie");
  });

  it("extracts what-it-does functions", () => {
    expect(squalane.functions?.map((f) => f.slug)).toEqual([
      "skin-identical-ingredient",
      "emollient",
    ]);
  });

  it("extracts irritancy + comedogenicity", () => {
    expect(squalane.irritancy).toBe("0");
    expect(squalane.comedogenicity).toBe("1");
  });

  it("extracts the image url", () => {
    expect(squalane.image).toMatch(/squalane_original\.jpeg$/);
  });

  it("extracts cosing data", () => {
    expect(squalane.cosing).toBeDefined();
    expect(squalane.cosing?.cas).toBe("111-01-3");
    expect(squalane.cosing?.ec).toBe("203-825-6");
    expect(squalane.cosing?.iupacName).toBe(
      "2,6,10,15,19,23-Hexamethyltetracosane",
    );
    expect(squalane.cosing?.allFunctions).toContain("emollient");
  });

  it("extracts the details writeup", () => {
    expect(squalane.details).toMatch(/^It seems to us that squalane/);
  });

  it("extracts proof references", () => {
    expect(squalane.proof?.length).toBeGreaterThan(0);
    expect(squalane.proof?.[0]).toContain("Kim, Se-Kwon");
  });
});

describe("parseIngredientPage — tocopherol (richer page)", () => {
  it("has also-called + cosing + proof", () => {
    expect(tocopherol.name).toBe("Tocopherol");
    expect(tocopherol.cosing?.cas).toBeTruthy();
    expect(tocopherol.proof?.length).toBeGreaterThan(0);
  });
});

describe("parseIngredientProductsPage — tocopherol", () => {
  const result = parseIngredientProductsPage(
    fixture("ingredient-tocopherol.html"),
    BASE_URL,
  );

  it("lists other products (deduped) with next-page link", () => {
    expect(result.products.items.length).toBeGreaterThan(20);
    expect(new Set(result.products.items.map((i) => i.slug)).size).toBe(
      result.products.items.length,
    );
    expect(result.products.hasMore).toBe(true);
    expect(result.products.nextPageUrl).toMatch(/uoffset=1/);
  });

  it("extracts the known-amount carousel when present", () => {
    expect(result.knownAmountProducts).toBeDefined();
    const first = result.knownAmountProducts?.[0];
    expect(first?.slug).toBeTruthy();
    expect(first?.path).toMatch(/^\/products\//);
    expect(first?.url).toMatch(/^https:\/\/inkeedecoder\.com\/products\//);
  });
});

describe("parseIngredientProductsPage — squalane", () => {
  const result = parseIngredientProductsPage(
    fixture("ingredient-squalane.html"),
    BASE_URL,
  );

  it("parses known-amount percent + brand", () => {
    const withPercent = result.knownAmountProducts?.find((p) => p.percent);
    expect(withPercent).toBeDefined();
    expect(withPercent?.brand).toBeTruthy();
  });
});

const SYNTHETIC = `
<script id="global">{"ingredientDisplayName":"Synthetic Acid","ingredientSlug":"synthetic-acid"}</script>
<div class="ingredinfobox">
  <div class="itemprop">
    <span class="label">What-it-does: </span>
    <span class="value"><a href="/ingredient-functions/emollient">emollient</a></span>
  </div>
  <div class="itemprop">
    <span class="label">Also-called-like-this: </span>
    <span class="value">Synth Acid, SA</span>
  </div>
</div>
<div class="inginfocontainer"><picture><img src="/img/synthetic.jpg"></picture></div>
<div id="cosing-data"><div class="fs16 hidden">
  <div><b>CAS #:</b> 123-45-6</div>
  <div><b>Chemical/IUPAC Name:</b> </div>
</div></div>
<div id="known-amount-carousel">
  <div class="productpreviewbox-v2">
    <a href="/products/thing-50"><img src="/p.jpg"></a>
    <div class="titlebox-v2">50% | Thing Cream</div>
    <div class="brandtitlebox-v2">Brand X</div>
  </div>
  <div class="productpreviewbox-v2"><div class="titlebox-v2">No link</div></div>
</div>
<a data-ga-eventcategory="ingredient-product" href="/products/thing-50">Thing</a>
<a data-ga-eventcategory="ingredient-product" href="/products/thing-50?x=1">Thing dup</a>
`;

describe("parseIngredientPage — synthetic full page", () => {
  const ing = parseIngredientPage(SYNTHETIC, BASE_URL);

  it("reads identity from the #global JSON", () => {
    expect(ing.slug).toBe("synthetic-acid");
    expect(ing.name).toBe("Synthetic Acid");
  });

  it("reads functions and also-called from the infobox itemprops", () => {
    expect(ing.functions?.map((f) => f.slug)).toEqual(["emollient"]);
    expect(ing.alsoCalled).toBe("Synth Acid, SA");
  });

  it("absolutizes the ingredient image", () => {
    expect(ing.image).toBe(`${BASE_URL}/img/synthetic.jpg`);
  });

  it("keeps only cosing labels that carry a value", () => {
    expect(ing.cosing).toEqual({ cas: "123-45-6" });
  });
});

describe("parseIngredientPage — slug-fallback page", () => {
  const ing = parseIngredientPage(
    `<script id="global">not-json{{{</script><h1>Orphan Acid</h1>
     <div class="inginfocontainer"><a href="/ingredients/orphan-acid">Orphan</a></div>`,
    BASE_URL,
  );

  it("survives invalid #global JSON and falls back to the page anchors", () => {
    expect(ing.slug).toBe("orphan-acid");
    expect(ing.name).toBe("Orphan Acid");
    expect(ing.ourTake).toBeNull();
    expect(ing.alsoCalled).toBeUndefined();
    expect(ing.image).toBeUndefined();
    expect(ing.cosing).toBeUndefined();
  });
});
