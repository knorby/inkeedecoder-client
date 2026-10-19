import { describe, expect, it } from "vitest";
import {
  delay,
  joinUrl,
  normalizeEntityId,
  parsePath,
  pathType,
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
    expect(normalizeText("")).toBe("");
  });
});

describe("joinUrl", () => {
  it("returns the base unchanged for an empty path", () => {
    expect(joinUrl("https://x.test/base/", "")).toBe("https://x.test/base/");
  });
});

describe("parsePath", () => {
  it("prefixes a bare relative href with /", () => {
    expect(parsePath("products/foo?x=1#frag")).toBe("/products/foo");
  });
});

describe("pathType", () => {
  it("returns the first path segment", () => {
    expect(pathType("/ingredients/squalane")).toBe("ingredients");
  });

  it("returns undefined for an empty path", () => {
    expect(pathType("")).toBeUndefined();
  });
});

describe("normalizeEntityId", () => {
  it("falls back to the type path for an empty id", () => {
    expect(normalizeEntityId("", "products")).toEqual({
      slug: "",
      path: "/products",
    });
  });
});

describe("delay", () => {
  it("resolves immediately for an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const started = Date.now();
    await delay(60_000, controller.signal);
    expect(Date.now() - started).toBeLessThan(50);
  });

  it("resolves immediately for non-positive durations", async () => {
    const started = Date.now();
    await delay(0);
    expect(Date.now() - started).toBeLessThan(50);
  });

  it("ends early when aborted mid-wait", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 10);
    const started = Date.now();
    await delay(60_000, controller.signal);
    expect(Date.now() - started).toBeLessThan(1000);
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

  it("leaves mismatched quote pairs alone", () => {
    expect(stripQuotes("\u201cmixed\"")).toBe("\u201cmixed\"");
    expect(stripQuotes("\"mixed\u201d")).toBe("\"mixed\u201d");
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
  it("joinUrl prefixes a relative (non-slash) path", () => {
    expect(joinUrl("https://x.test", "products/foo")).toBe(
      "https://x.test/products/foo",
    );
  });

  it("parsePath reduces protocol-relative and bare-origin hrefs", () => {
    expect(parsePath("//host/x")).toBe("/x");
    expect(parsePath("//host")).toBe("/");
    expect(parsePath("https://host")).toBe("");
    expect(parsePath("?q=1")).toBe("");
  });

  it("normalizeEntityId strips queries from absolute URLs", () => {
    expect(
      normalizeEntityId("https://x.test/ingredients/squalane?ref=x", "items"),
    ).toEqual({ slug: "squalane", path: "/ingredients/squalane" });
  });

  it("joinUrl handles paths, absolute, protocol-relative", () => {
    expect(joinUrl("https://inkeedecoder.com", "/products/x")).toBe(
      "https://inkeedecoder.com/products/x",
    );
    expect(joinUrl("https://inkeedecoder.com/", "https://other.com/y")).toBe(
      "https://other.com/y",
    );
    expect(joinUrl("https://inkeedecoder.com", "//cdn/x")).toBe(
      "https://cdn/x",
    );
  });

  it("parsePath reduces hrefs to site paths", () => {
    expect(
      parsePath("https://inkeedecoder.com/ingredients/squalane?x=1#y"),
    ).toBe("/ingredients/squalane");
    expect(parsePath("/brands/the-ordinary")).toBe("/brands/the-ordinary");
  });

  it("parsePath handles protocol-relative hrefs", () => {
    expect(parsePath("//cdn.example.com/img/x.png?v=1")).toBe("/img/x.png");
    expect(parsePath("//cdn.example.com")).toBe("/");
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
        "https://inkeedecoder.com/brands/the-ordinary",
        "brands",
      ),
    ).toEqual({ slug: "the-ordinary", path: "/brands/the-ordinary" });
  });

  it("normalizeEntityId strips query/hash from relative ids", () => {
    expect(normalizeEntityId("/products/foo?ppage=2", "products")).toEqual({
      slug: "foo",
      path: "/products/foo",
    });
    expect(normalizeEntityId("squalane#functions", "ingredients")).toEqual({
      slug: "squalane",
      path: "/ingredients/squalane",
    });
  });
});
