import { describe, expect, it } from "vitest";
import {
  joinUrl,
  normalizeEntityId,
  parsePath,
  slugFromPath,
} from "../src/util/refs.js";
import {
  extractPercent,
  normalizeText,
  ourTakeFromClass,
  ourTakeFromText,
  stripQuotes,
} from "../src/util/text.js";

describe("normalizeText", () => {
  it("strips zero-width characters", () => {
    expect(normalizeText("Caprylic/​Capric")).toBe("Caprylic/Capric");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("  a\n  b\tc  ")).toBe("a b c");
  });

  it("handles nullish input", () => {
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("extractPercent", () => {
  it("pulls a percentage from display text", () => {
    expect(extractPercent("Retinol 1.0%")).toBe("1.0");
    expect(extractPercent("Niacinamide 10% + Zinc 1%")).toBe("10");
  });

  it("normalizes decimal commas", () => {
    expect(extractPercent("Retinol 0,5%")).toBe("0.5");
  });

  it("returns undefined when none", () => {
    expect(extractPercent("Squalane")).toBeUndefined();
  });
});

describe("stripQuotes", () => {
  it("strips straight double quotes", () => {
    expect(stripQuotes('"hi there"')).toBe("hi there");
  });

  it("strips smart quotes", () => {
    expect(stripQuotes("\u201chi\u201d")).toBe("hi");
  });

  it("leaves unquoted text alone", () => {
    expect(stripQuotes("hello")).toBe("hello");
  });
});

describe("our-take helpers", () => {
  it("reads rating from CSS class", () => {
    expect(ourTakeFromClass("info-circle our-take-superstar tooltip")).toBe(
      "superstar",
    );
    expect(ourTakeFromClass("our-take-goodie")).toBe("goodie");
    expect(ourTakeFromClass("our-take-icky")).toBe("icky");
    expect(ourTakeFromClass("our-take-no-take")).toBeUndefined();
  });

  it("reads rating from display text", () => {
    expect(ourTakeFromText("- goodie")).toBe("goodie");
    expect(ourTakeFromText("superstar")).toBe("superstar");
    expect(ourTakeFromText("Goodie")).toBe("goodie");
    expect(ourTakeFromText("nope")).toBeUndefined();
  });
});

describe("url/path helpers", () => {
  it("joinUrl handles paths, absolute, protocol-relative", () => {
    expect(joinUrl("https://incidecoder.com", "/products/x")).toBe(
      "https://incidecoder.com/products/x",
    );
    expect(joinUrl("https://incidecoder.com/", "https://other.com/y")).toBe(
      "https://other.com/y",
    );
    expect(joinUrl("https://incidecoder.com", "//cdn/x")).toBe("https://cdn/x");
  });

  it("parsePath reduces hrefs to site paths", () => {
    expect(
      parsePath("https://incidecoder.com/ingredients/squalane?x=1#y"),
    ).toBe("/ingredients/squalane");
    expect(parsePath("/brands/the-ordinary")).toBe("/brands/the-ordinary");
  });

  it("slugFromPath returns the last segment", () => {
    expect(slugFromPath("/ingredient-functions/emollient")).toBe("emollient");
    expect(slugFromPath("/products/the-ordinary-buffet")).toBe(
      "the-ordinary-buffet",
    );
  });

  it("normalizeEntityId prefixes a bare slug", () => {
    expect(normalizeEntityId("squalane", "ingredients")).toEqual({
      slug: "squalane",
      path: "/ingredients/squalane",
    });
    expect(normalizeEntityId("/products/x", "products")).toEqual({
      slug: "x",
      path: "/products/x",
    });
    expect(
      normalizeEntityId(
        "https://incidecoder.com/brands/the-ordinary",
        "brands",
      ),
    ).toEqual({ slug: "the-ordinary", path: "/brands/the-ordinary" });
  });
});
