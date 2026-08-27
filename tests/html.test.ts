import type { AnyNode } from "domhandler";
import { describe, expect, it } from "vitest";
import { parseHtml } from "../src/html.js";

const DOC = `
<html>
  <body>
    <div id="wrap">
      <a class="item" href="/one">One</a>
      <span class="mid">mid</span>
      <div class="group">
        <a class="item deep" href="/two">Two</a>
        <p>para</p>
      </div>
      text-tail
    </div>
    <section id="json">{"a":1}</section>
  </body>
</html>
`;

describe("parseHtml — $ overloads", () => {
  const $ = parseHtml(DOC);

  it("selects by CSS selector (ids, classes, combinators)", () => {
    expect($("#wrap").length).toBe(1);
    expect($(".item").length).toBe(2);
    expect($(".group a.deep").length).toBe(1);
    expect($("div.group > p").length).toBe(1);
  });

  it("supports comma-separated selector lists", () => {
    expect($("p, .mid").length).toBe(2);
  });

  it("supports attribute selectors", () => {
    expect($('a[href="/one"]').length).toBe(1);
    expect($("a[class*='deep']").length).toBe(1);
  });

  it("wraps a single raw node (as callbacks provide them)", () => {
    let raw: AnyNode | undefined;
    $(".mid").each((_, el) => {
      raw = el;
    });
    expect($(raw ?? null).attr("class")).toBe("mid");
  });

  it("wraps an array of raw nodes", () => {
    const nodes: AnyNode[] = [];
    $("a.item").each((_, el) => {
      nodes.push(el);
    });
    expect(nodes.length).toBe(2);
    expect($(nodes).text()).toContain("One");
  });

  it("re-wraps another wrapper instance", () => {
    const $first = $(".item").first();
    expect($($first).attr("href")).toBe("/one");
  });
});

describe("parseHtml — attribute and text access", () => {
  const $ = parseHtml(DOC);

  it("reads the attribute of the first matched element", () => {
    expect($(".item").attr("href")).toBe("/one");
  });

  it("returns undefined for missing attributes or empty sets", () => {
    expect($("#wrap").attr("href")).toBeUndefined();
    expect($(".nothere").attr("href")).toBeUndefined();
    expect($(".nothere").length).toBe(0);
  });

  it("concatenates descendant text across the set", () => {
    const t = $("#wrap").text();
    expect(t).toContain("One");
    expect(t).toContain("mid");
    expect(t).toContain("Two");
    expect(t).toContain("para");
  });

  it("returns '' for empty sets", () => {
    expect($(".nothere").text()).toBe("");
  });
});

describe("parseHtml — traversal", () => {
  const $ = parseHtml(DOC);

  it("find() matches only descendants", () => {
    // #wrap contains both anchors; .group contains only the deep one.
    expect($("#wrap").find("a.item").length).toBe(2);
    expect($(".group").find("a.item").length).toBe(1);
    expect($(".group").find(".group").length).toBe(0);
  });

  it("children(selector) filters direct children", () => {
    const kids = $("#wrap").children("div");
    expect(kids.length).toBe(1);
    expect(kids.attr("class")).toBe("group");
    expect($("#wrap").children().length).toBe(3); // a, span, div
  });

  it("contents() includes raw text nodes", () => {
    const first = $("#json").contents().first();
    expect(first.length).toBe(1);
    expect(first.text()).toContain('{"a":1}');
  });

  it("nextAll(selector) returns following siblings only", () => {
    const circles = $(".mid").nextAll("a");
    expect(circles.length).toBe(0); // following siblings are .group div + text
    expect($(".mid").nextAll().length).toBeGreaterThanOrEqual(1);
    const afterFirst = $("a.item").first().nextAll("span");
    expect(afterFirst.length).toBe(1);
    expect(afterFirst.attr("class")).toBe("mid");
  });

  it("eq(i) indexes into the set", () => {
    const items = $("a.item");
    expect(items.eq(0).attr("href")).toBe("/one");
    expect(items.eq(1).attr("href")).toBe("/two");
    expect(items.eq(9).length).toBe(0);
  });

  it("first() and last() bound the set", () => {
    const items = $("a.item");
    expect(items.first().attr("href")).toBe("/one");
    expect(items.last().attr("href")).toBe("/two");
    expect($(".nothere").first().length).toBe(0);
    expect($(".nothere").last().length).toBe(0);
  });

  it("addBack(selector) re-adds the scope when it matches", () => {
    // $(scope).find("a").addBack("a") — pagination's exact pattern, with a
    // raw node scope like findNextLink receives.
    let scope: AnyNode | undefined;
    $("#wrap").each((_, el) => {
      scope = el;
    });
    const $fromScope = $(scope ?? null);
    const withSelf = $fromScope.find("a.item").addBack("#wrap");
    expect(withSelf.find("a.item").length).toBe(2);
    // Scope does not match "a", so addBack("a") is a no-op here.
    const noSelf = $fromScope.find("a.item").addBack("a");
    expect(noSelf.length).toBe(2);
  });
});

describe("parseHtml — iteration", () => {
  it("each() yields raw nodes with indices and stops on false", () => {
    const $ = parseHtml(DOC);
    const seen: string[] = [];
    const stopped = $("a.item").each((i, el) => {
      seen.push(`${i}:${$(el).attr("href")}`);
      return false; // break after the first
    });
    expect(seen).toEqual(["0:/one"]);
    // each() should still return something chainable/undefined-safe.
    expect(stopped).toBeDefined();
  });

  it("each() visits every element when callbacks never break", () => {
    const $ = parseHtml(DOC);
    let count = 0;
    $("#wrap")
      .find("*")
      .each(() => {
        count++;
      });
    expect(count).toBeGreaterThan(2);
  });
});
