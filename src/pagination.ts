import type { BasicAcceptedElems, CheerioAPI } from "cheerio/slim";
import type { AnyNode } from "domhandler";
import type { Paginated } from "./types.js";
import { delay, joinUrl } from "./util/refs.js";

const NEXT_PAGE_RE = /next page/i;

/** Raw list page before a page number is assigned by the caller. */
export interface RawList<T> {
  items: T[];
  hasMore: boolean;
  nextPageUrl?: string;
}

/**
 * Find the authoritative "Next page >>" link inside a scope. INKEEDecoder uses
 * different pagination params per page type (`ppage`, `uoffset`, `offset`); by
 * extracting the link from the HTML we never have to construct or guess them.
 */
export function findNextLink(
  $: CheerioAPI,
  scope: BasicAcceptedElems<AnyNode>,
  baseUrl: string,
): string | undefined {
  const links = $(scope).find("a").addBack("a");
  let found: string | undefined;
  links.each((_, el) => {
    const $el = $(el);
    const text = $el.text();
    const href = $el.attr("href");
    if (href && NEXT_PAGE_RE.test(text)) {
      found = joinUrl(baseUrl, href);
      return false; // break
    }
    return true;
  });
  return found;
}

/** Attach a 1-based page number to a raw list. */
export function makePaginated<T>(raw: RawList<T>, page: number): Paginated<T> {
  return {
    items: raw.items,
    page,
    hasMore: raw.hasMore,
    nextPageUrl: raw.nextPageUrl,
  };
}

/**
 * Follow `nextPageUrl` links, merging all items, up to `maxPages` total pages,
 * spacing requests with `delayMs`. The `fetchAndParse` callback receives the
 * next URL and returns the next raw list. Used for `allPages: true`.
 */
export async function paginateAll<T>(
  first: RawList<T>,
  fetchAndParse: (url: string) => Promise<RawList<T>>,
  opts: { maxPages: number; delayMs: number },
): Promise<RawList<T>> {
  const all: T[] = [...first.items];
  let next = first.nextPageUrl;
  let pages = 1;
  let hasMore = first.hasMore;
  while (next && pages < opts.maxPages) {
    await delay(opts.delayMs);
    const res = await fetchAndParse(next);
    all.push(...res.items);
    next = res.nextPageUrl;
    hasMore = res.hasMore;
    pages++;
  }
  // If we stopped because of maxPages but there are more pages, keep hasMore true.
  return { items: all, hasMore: Boolean(next) || hasMore, nextPageUrl: next };
}
