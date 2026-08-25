/**
 * Parsers for the "simple text list" pages: search (both tabs), advanced product
 * search, brand product lists, and ingredient-function ingredient lists. They
 * all render results as `a.simpletextlistitem` anchors and a "Next page >>" link.
 */
import type { HtmlScope } from "../html.js";
import { parseHtml, refFromAnchor } from "../html.js";
import type { RawList } from "../pagination.js";
import { findNextLink } from "../pagination.js";
import type { Ref } from "../types.js";
import { normalizeText } from "../util/text.js";

/** Parse `a.simpletextlistitem` links (deduped by slug) + next-page link. */
export function parseSimpleList(
  $: ReturnType<typeof parseHtml>,
  scope: HtmlScope,
  baseUrl: string,
): RawList<Ref> {
  const items: Ref[] = [];
  const seen = new Set<string>();
  $(scope)
    .find("a.simpletextlistitem")
    .each((_, el) => {
      const ref = refFromAnchor($, el, baseUrl);
      if (!ref.slug || seen.has(ref.slug)) {
        return;
      }
      seen.add(ref.slug);
      items.push(ref);
    });
  const nextPageUrl = findNextLink($, scope, baseUrl);
  return { items, hasMore: Boolean(nextPageUrl), nextPageUrl };
}

export interface ParsedSearch {
  query: string;
  products: RawList<Ref>;
  ingredients: RawList<Ref>;
}

/** Parse the combined search page (`/search?query=...`). */
export function parseSearchPage(html: string, baseUrl: string): ParsedSearch {
  const $ = parseHtml(html);
  const query =
    normalizeText($("h1 i").first().text()) ||
    normalizeText($("input[name='query']").first().attr("value") ?? "");
  const products = parseSimpleList($, "#products", baseUrl);
  const ingredients = parseSimpleList($, "#ingredients", baseUrl);
  return { query, products, ingredients };
}

/** Parse an advanced product-search results page (`/search/product?...`). */
export function parseSearchProductsPage(
  html: string,
  baseUrl: string,
): RawList<Ref> {
  const $ = parseHtml(html);
  // The advanced page has no #products/.detailpage wrapper; scope the whole doc.
  return parseSimpleList($, "body", baseUrl);
}

export interface ParsedBrand {
  name: string;
  products: RawList<Ref>;
}

/** Parse a brand page (`/brands/{slug}`) — name + paginated product list. */
export function parseBrandPage(html: string, baseUrl: string): ParsedBrand {
  const $ = parseHtml(html);
  const h1 = normalizeText($("h1").first().text());
  const name = h1.replace(/\s+products\s*$/i, "").trim() || h1;
  const products = parseSimpleList($, ".detailpage", baseUrl);
  return { name, products };
}

export interface ParsedIngredientFunction {
  name: string;
  description?: string;
  ingredients: RawList<Ref>;
}

/** Parse an ingredient-function page (`/ingredient-functions/{slug}`). */
export function parseIngredientFunctionPage(
  html: string,
  baseUrl: string,
): ParsedIngredientFunction {
  const $ = parseHtml(html);
  const name = normalizeText($("h1").first().text());
  const descParas: string[] = [];
  $(".detailpage .greybottomborder p").each((_, p) => {
    const t = normalizeText($(p).text());
    if (t) {
      descParas.push(t);
    }
  });
  const description = descParas.join("\n\n") || undefined;
  const ingredients = parseSimpleList($, ".bggrey", baseUrl);
  return { name, description, ingredients };
}
