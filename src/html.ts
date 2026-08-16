/**
 * Cheerio is the only runtime dependency. It is imported **only** here, from
 * `cheerio/slim`, which excludes `parse5` and `undici` — the slim export works
 * in React Native/Metro where full cheerio's `fromURL`→undici import breaks
 * bundling. Type-only imports (`BasicAcceptedElems` from cheerio, `AnyNode`
 * from domhandler) are erased at compile time, so no runtime/bundle impact.
 * If slim's htmlparser2 parser ever proves insufficient for a page, swap the
 * `load` import in this single file (e.g. to `cheerio/load`) without touching
 * the rest of the codebase.
 */
import type { BasicAcceptedElems, CheerioAPI } from "cheerio/slim";
import { load } from "cheerio/slim";
import type { AnyNode } from "domhandler";
import type { Ref } from "./types.js";
import { joinUrl, parsePath, slugFromPath } from "./util/refs.js";
import { normalizeText } from "./util/text.js";

/** Parse an HTML string into a Cheerio root. */
export function parseHtml(html: string): CheerioAPI {
  return load(html, undefined, false);
}

/**
 * Build a {@link Ref} from an anchor element given the site base URL. Names are
 * normalized (zero-width characters stripped); the slug is derived from the href.
 */
export function refFromAnchor(
  $: CheerioAPI,
  anchor: BasicAcceptedElems<AnyNode>,
  baseUrl: string,
): Ref {
  const $a = $(anchor);
  const href = $a.attr("href") ?? "";
  const path = parsePath(href);
  const name = normalizeText($a.text());
  const slug = slugFromPath(path) ?? "";
  return { name, slug, path, url: joinUrl(baseUrl, path) };
}

export type { CheerioAPI };
