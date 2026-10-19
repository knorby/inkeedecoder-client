import { describe, expect, it } from "vitest";
import { paginateAll, type RawList } from "../src/pagination.js";

/** A `fetchAndParse` over a synthetic chain of `n` walkable pages. */
function chain(n: number) {
  const calls: string[] = [];
  return {
    calls,
    fetchAndParse: async (url: string): Promise<RawList<string>> => {
      calls.push(url);
      const i = Number(url.match(/page(\d+)/)?.[1] ?? 1);
      const next = i < n ? `https://x.test/page${i + 1}` : undefined;
      return { items: [`i${i}`], hasMore: Boolean(next), nextPageUrl: next };
    },
  };
}

describe("paginateAll", () => {
  it("spaces pages with delayMs when set", async () => {
    const { calls, fetchAndParse } = chain(2);

    const started = Date.now();
    const all = await paginateAll<string>(
      { items: ["first"], hasMore: true, nextPageUrl: "https://x.test/page1" },
      fetchAndParse,
      { maxPages: 25, delayMs: 25 },
    );

    expect(all.items).toEqual(["first", "i1", "i2"]);
    expect(calls).toEqual(["https://x.test/page1", "https://x.test/page2"]);
    // Two page transitions, each spaced by ~delayMs.
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
  });

  it("honours maxPages and omits delayMs when unset", async () => {
    const { calls, fetchAndParse } = chain(5);

    const started = Date.now();
    const all = await paginateAll<string>(
      { items: ["first"], hasMore: true, nextPageUrl: "https://x.test/page1" },
      fetchAndParse,
      { maxPages: 2 },
    );

    // maxPages counts the first page, so only one extra page is fetched.
    expect(all.items).toEqual(["first", "i1"]);
    expect(calls).toEqual(["https://x.test/page1"]);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
