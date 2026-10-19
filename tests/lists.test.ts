import { describe, expect, it } from "vitest";
import {
  parseBrandPage,
  parseIngredientFunctionPage,
  parseSearchPage,
  parseSearchProductsPage,
} from "../src/parse/lists.js";
import { BASE_URL, fixture } from "./helpers.js";

describe("parseSearchPage — 'the ordinary' (products only)", () => {
  const r = parseSearchPage(fixture("search-the-ordinary.html"), BASE_URL);

  it("reads the query", () => {
    expect(r.query).toBe("the ordinary");
  });

  it("returns ~50 product hits on page 1", () => {
    expect(r.products.items.length).toBe(50);
  });

  it("has a product-tab next page link and no ingredient results", () => {
    expect(r.products.hasMore).toBe(true);
    expect(r.products.nextPageUrl).toMatch(/ppage=2/);
    expect(r.ingredients.items.length).toBe(0);
    expect(r.ingredients.hasMore).toBe(false);
  });

  it("builds product refs with slug keys", () => {
    const buffet = r.products.items.find(
      (i) => i.slug === "the-ordinary-buffet",
    );
    expect(buffet?.name).toBe("The Ordinary Buffet");
    expect(buffet?.path).toBe("/products/the-ordinary-buffet");
    expect(buffet?.url).toBe(
      "https://inkeedecoder.com/products/the-ordinary-buffet",
    );
  });
});

describe("parseSearchPage — 'squalane' (has ingredient results)", () => {
  const r = parseSearchPage(fixture("search-squalane.html"), BASE_URL);

  it("returns ingredient-tab results", () => {
    expect(r.query).toBe("squalane");
    expect(r.ingredients.items.length).toBeGreaterThan(0);
    expect(r.ingredients.items[0]?.slug).toBeTruthy();
  });
});

describe("parseSearchPage — products page 2", () => {
  const r = parseSearchPage(
    fixture("search-squalane-products-page2.html"),
    BASE_URL,
  );

  it("parses page-2 product hits", () => {
    expect(r.products.items.length).toBeGreaterThan(0);
    // Page 2 is fetched via activetab=products&ppage=2 — may or may not have
    // a further next link; just confirm items parse.
    expect(r.products.items[0]?.path).toMatch(/^\/products\//);
  });
});

describe("parseSearchProductsPage — advanced include filter", () => {
  const r = parseSearchProductsPage(
    fixture("search-products-advanced.html"),
    BASE_URL,
  );

  it("returns filtered product hits as refs", () => {
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items[0]?.path).toMatch(/^\/products\//);
    expect(r.items[0]?.url).toMatch(/^https:\/\/inkeedecoder\.com\/products\//);
  });
});

describe("parseBrandPage — the ordinary", () => {
  const r = parseBrandPage(fixture("brand-the-ordinary.html"), BASE_URL);

  it("strips ' products' from the heading", () => {
    expect(r.name).toBe("The Ordinary");
  });

  it("lists ~50 products with an offset-based next link", () => {
    expect(r.products.items.length).toBe(50);
    expect(r.products.hasMore).toBe(true);
    expect(r.products.nextPageUrl).toMatch(/offset=1/);
  });
});

describe("parseIngredientFunctionPage — emollient", () => {
  const r = parseIngredientFunctionPage(
    fixture("ingredient-function-emollient.html"),
    BASE_URL,
  );

  it("reads name + description", () => {
    expect(r.name).toBe("emollient");
    expect(r.description).toMatch(/^Nice ingredients that make your skin/);
  });

  it("lists ~50 ingredients with an offset-based next link", () => {
    expect(r.ingredients.items.length).toBe(50);
    expect(r.ingredients.hasMore).toBe(true);
    expect(r.ingredients.nextPageUrl).toMatch(/offset=1/);
    expect(r.ingredients.items[0]?.path).toMatch(/^\/ingredients\//);
  });
});

describe("parseSearchPage — synthetic list", () => {
  const r = parseSearchPage(
    `<div class='detailpage'>
      <div id='products'>
        <a class='simpletextlistitem' href='/products/a'>Alpha</a>
        <a class='simpletextlistitem' href='/products/a?x=1'>Alpha dup</a>
        <a class='simpletextlistitem' href=''>No slug</a>
      </div>
      <div id='ingredients'></div>
    </div>`,
    BASE_URL,
  );

  it("dedupes by slug and drops slug-less anchors", () => {
    expect(r.products.items).toHaveLength(1);
    expect(r.products.items[0]?.slug).toBe("a");
    expect(r.products.items[0]?.name).toBe("Alpha");
  });
});
