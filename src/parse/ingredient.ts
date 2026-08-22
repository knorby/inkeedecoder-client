import type { BasicAcceptedElems, CheerioAPI } from "cheerio/slim";
import type { AnyNode } from "domhandler";
import { parseHtml, refFromAnchor } from "../html.js";
import type { RawList } from "../pagination.js";
import type {
  FunctionRef,
  Ingredient,
  KnownAmountProductRef,
  Ref,
} from "../types.js";
import { joinUrl, parsePath } from "../util/refs.js";
import { normalizeText, ourTakeFromText } from "../util/text.js";

interface GlobalJson {
  ingredientDisplayName?: string;
  ingredientSlug?: string;
}

function readGlobalJson($: CheerioAPI): GlobalJson {
  const raw = $("#global").contents().first().text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw) as GlobalJson;
  } catch {
    return {};
  }
}

function findItempropValue(
  $: CheerioAPI,
  scope: BasicAcceptedElems<AnyNode>,
  labelMatch: RegExp,
): string | undefined {
  let value: string | undefined;
  $(scope)
    .find(".itemprop")
    .each((_, el) => {
      const $ip = $(el);
      const label = normalizeText($ip.find(".label").text()).toLowerCase();
      if (labelMatch.test(label)) {
        // The info-circle tooltip span is inside `.value` sometimes; the text
        // is still fine after normalization because tooltips are empty visually.
        value = normalizeText($ip.find(".value").text()) || undefined;
        return false;
      }
      return true;
    });
  return value;
}

/** Parse an ingredient page into a full {@link Ingredient}. */
export function parseIngredientPage(html: string, baseUrl: string): Ingredient {
  const $ = parseHtml(html);
  const global = readGlobalJson($);

  const name =
    normalizeText(global.ingredientDisplayName) ||
    normalizeText($("h1").first().text());
  const slug = global.ingredientSlug ?? slugFallback($) ?? "";

  const ourTake = ourTakeFromText($(".ourtake").first().text());

  const infobox = $(".ingredinfobox, .ingrednexttoimage").first();

  const functions: FunctionRef[] = [];
  infobox
    .find(".itemprop .value a[href*='/ingredient-functions/']")
    .each((_, a) => {
      // Only "What-it-does" links; the also-called `.value` has no function links.
      functions.push(refFromAnchor($, a, baseUrl) as FunctionRef);
    });

  const alsoCalled = findItempropValue($, infobox, /also-called/);
  const irritancy = findItempropValue($, infobox, /irritancy/);
  const comedogenicity = findItempropValue($, infobox, /comedogenicity/);

  const image = (() => {
    const src = $(".inginfocontainer picture img").attr("src");
    return src ? joinUrl(baseUrl, src) : undefined;
  })();

  const cosing = parseCosing($);

  const details = (() => {
    const t = normalizeText($("#details .content").text());
    return t || undefined;
  })();

  const proof = parseProof($);

  const path = `/ingredients/${slug}`;
  return {
    slug,
    name,
    path,
    url: joinUrl(baseUrl, path),
    // Always present; `null` when the page carries no rating.
    ourTake: ourTake ?? null,
    functions,
    alsoCalled,
    image,
    irritancy,
    comedogenicity,
    cosing,
    details,
    proof,
  };
}

function slugFallback($: CheerioAPI): string | undefined {
  const href = $(".inginfocontainer a[href*='/ingredients/']").attr("href");
  if (!href) {
    return undefined;
  }
  const segs = parsePath(href).split("/").filter(Boolean);
  return segs[segs.length - 1];
}

function valueAfterB($: CheerioAPI, b: AnyNode): string {
  let val = "";
  let node: AnyNode | null = (b as AnyNode).nextSibling as AnyNode | null;
  while (node) {
    if (node.type === "tag" && (node as { tagName?: string }).tagName === "b") {
      break;
    }
    val += $(node).text();
    node = (node.nextSibling as AnyNode | null) ?? null;
  }
  return normalizeText(val);
}

function parseCosing($: CheerioAPI): Ingredient["cosing"] {
  const $hidden = $("#cosing-data .hidden").first();
  if (!$hidden.length) {
    return undefined;
  }
  let allFunctions: string | undefined;
  let cas: string | undefined;
  let ec: string | undefined;
  let iupacName: string | undefined;
  $hidden.find("b").each((_, b) => {
    const label = normalizeText($(b).text()).toLowerCase();
    const value = valueAfterB($, b).replace(/\|/g, "").trim();
    if (!value) {
      return;
    }
    if (label.includes("all functions")) {
      allFunctions = value;
    } else if (label.includes("cas")) {
      cas = value;
    } else if (label.includes("ec")) {
      ec = value;
    } else if (label.includes("iupac") || label.includes("chemical")) {
      iupacName = value;
    }
  });
  const out: Ingredient["cosing"] = {};
  if (allFunctions) {
    out.allFunctions = allFunctions;
  }
  if (cas) {
    out.cas = cas;
  }
  if (ec) {
    out.ec = ec;
  }
  if (iupacName) {
    out.iupacName = iupacName;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseProof($: CheerioAPI): string[] | undefined {
  const items: string[] = [];
  $("#proof ul.doclist li").each((_, li) => {
    const t = normalizeText($(li).text());
    if (t) {
      items.push(t);
    }
  });
  return items.length ? items : undefined;
}

/**
 * Parse the "Other products with X" list (and optional known-amount carousel)
 * from an ingredient page. The paginated product list is a {@link RawList};
 * the carousel only appears on page 1.
 */
export function parseIngredientProductsPage(
  html: string,
  baseUrl: string,
): { products: RawList<Ref>; knownAmountProducts?: KnownAmountProductRef[] } {
  const $ = parseHtml(html);
  const items: Ref[] = [];
  const seen = new Set<string>();
  $("a[data-ga-eventcategory='ingredient-product']").each((_, el) => {
    const ref = refFromAnchor($, el, baseUrl);
    if (!ref.slug || seen.has(ref.slug)) {
      return;
    }
    seen.add(ref.slug);
    items.push(ref);
  });
  const nextPageUrl = (() => {
    // NOTE: "ingreient" is inkeedecoder.com's own typo in this attribute
    // value — it matches the live site, so do not "fix" it.
    const href = $("a[data-ga-eventcategory='ingreient-product-next']").attr(
      "href",
    );
    if (href) {
      return joinUrl(baseUrl, href);
    }
    return undefined;
  })();

  const knownAmountProducts = parseKnownAmount($, baseUrl);

  return {
    products: {
      items,
      hasMore: Boolean(nextPageUrl),
      nextPageUrl,
    },
    knownAmountProducts: knownAmountProducts.length
      ? knownAmountProducts
      : undefined,
  };
}

function parseKnownAmount(
  $: CheerioAPI,
  baseUrl: string,
): KnownAmountProductRef[] {
  const out: KnownAmountProductRef[] = [];
  $("#known-amount-carousel .productpreviewbox-v2").each((_, box) => {
    const $box = $(box);
    const $a = $box.find("a").first();
    const href = $a.attr("href") ?? "";
    const path = href.startsWith("/") ? href : `/${href}`;
    const slug = path.split("/").filter(Boolean).pop() ?? "";
    const title = normalizeText($box.find(".titlebox-v2").text());
    const brand =
      normalizeText($box.find(".brandtitlebox-v2").text()) || undefined;
    const imgSrc = $box.find("img").attr("src");
    let percent: string | undefined;
    let name = title;
    const splitIdx = title.indexOf("|");
    if (splitIdx >= 0) {
      const left = normalizeText(title.slice(0, splitIdx));
      const right = normalizeText(title.slice(splitIdx + 1));
      const m = left.match(/(\d+(?:[.,]\d+)?)\s*%/);
      if (m) {
        percent = m[1]?.replace(",", ".");
      }
      name = right || title;
    }
    if (!slug) {
      return;
    }
    out.push({
      name,
      slug,
      path,
      url: joinUrl(baseUrl, path),
      percent,
      brand,
      image: imgSrc ? joinUrl(baseUrl, imgSrc) : undefined,
    });
  });
  return out;
}
