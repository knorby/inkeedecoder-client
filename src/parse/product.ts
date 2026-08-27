import type { Html } from "../html.js";
import { parseHtml, refFromAnchor } from "../html.js";
import type {
  BrandRef,
  FunctionRef,
  Hashtag,
  IngredientLongEntry,
  IngredientRef,
  IngredientsByFunction,
  Product,
  ProductTooltip,
  SkimRow,
} from "../types.js";
import { joinUrl, parsePath } from "../util/refs.js";
import {
  extractPercent,
  normalizeText,
  ourTakeFromClass,
  ourTakeFromText,
  stripQuotes,
} from "../util/text.js";

/** Parse a `srcset` attribute into absolute URLs (in declared order). */
function parseSrcset(srcset: string | undefined, baseUrl: string): string[] {
  if (!srcset) {
    return [];
  }
  return srcset
    .split(",")
    .map((part) => part.trim().split(/\s+/)[0] ?? "")
    .map((u) => (u ? joinUrl(baseUrl, u) : ""))
    .filter(Boolean);
}

/** Parse a product page HTML into a full {@link Product}. */
export function parseProductPage(html: string, baseUrl: string): Product {
  const $ = parseHtml(html);

  // Slug: from the "compare/add/<slug>" button (stable canonical id).
  const compareUrl =
    $("#compare-controls button[data-postlinkurl]").attr("data-postlinkurl") ??
    "";
  const slug = parsePath(compareUrl).split("/").filter(Boolean).pop() ?? "";

  const name = normalizeText($("#product-title").text());

  const brand = parseBrand($, baseUrl);

  const description = (() => {
    const raw = $("#product-details").text();
    const t = normalizeText(raw);
    return t ? stripQuotes(t) : undefined;
  })();

  const ingredients = parseIngredientsShort($, baseUrl);

  const images = parseImages($, baseUrl);

  const hashtags = parseHashtags($);

  const fullName = parseFullName($);

  const functions = parseByFunction($, baseUrl);

  const skimTable = parseSkimTable($, baseUrl);

  const dates = parseDates($);

  const tooltips = parseTooltips($, baseUrl);

  const longDescriptions = parseLongDescriptions($, baseUrl);

  const path = `/products/${slug}`;
  return {
    slug,
    name,
    path,
    url: joinUrl(baseUrl, path),
    brand,
    description,
    ingredients,
    images,
    hashtags: hashtags.length ? hashtags : undefined,
    fullName,
    functions,
    skimTable,
    dates,
    tooltips: tooltips.length ? tooltips : undefined,
    longDescriptions: longDescriptions.length ? longDescriptions : undefined,
  };
}

function parseBrand($: Html, baseUrl: string): BrandRef | undefined {
  const $a = $("#product-brand-title a").first();
  if (!$a.length || !$a.attr("href")) {
    return undefined;
  }
  return refFromAnchor($, $a, baseUrl) as BrandRef;
}

function parseIngredientsShort($: Html, baseUrl: string): IngredientRef[] {
  const out: IngredientRef[] = [];
  const seen = new Set<string>();
  $("#ingredlist-short")
    .find("a.ingred-link")
    .each((_, el) => {
      const $a = $(el);
      const ref = refFromAnchor($, el, baseUrl) as IngredientRef;
      if (!ref.slug) {
        return;
      }
      if (seen.has(ref.slug)) {
        return;
      }
      seen.add(ref.slug);
      const percent = extractPercent(ref.name);
      if (percent) {
        ref.percent = percent;
      }
      // Rating: sibling info-circle carries the our-take-* class.
      const circle = $a.nextAll("span.info-circle").first();
      if (circle.length) {
        const cls = circle.attr("class") ?? "";
        const take = ourTakeFromClass(cls);
        if (take) {
          ref.ourTake = take;
        }
      }
      out.push(ref);
    });
  return out;
}

function parseImages($: Html, baseUrl: string): Product["images"] {
  const $pic = $("#product-main-image picture");
  if (!$pic.length) {
    return undefined;
  }
  const original = $pic.find("img").attr("src");
  if (!original) {
    return undefined;
  }
  const webp: string[] = [];
  const jpeg: string[] = [];
  $pic.find("source").each((_, el) => {
    const type = $(el).attr("type");
    const srcset = $(el).attr("srcset");
    const urls = parseSrcset(srcset, baseUrl);
    if (type === "image/webp") {
      webp.push(...urls);
    } else if (type === "image/jpeg") {
      jpeg.push(...urls);
    }
  });
  return {
    original: joinUrl(baseUrl, original),
    webp,
    jpeg,
  };
}

function parseHashtags($: Html): Hashtag[] {
  const out: Hashtag[] = [];
  $("#ingredlist-highlights-section")
    .find(".hashtag")
    .each((_, el) => {
      const $el = $(el);
      const tag = normalizeText($el.text());
      if (!tag) {
        return;
      }
      const target = $el.attr("data-tooltip-content");
      let label = tag;
      if (target) {
        const sel = target.startsWith("#") ? target : `#${target}`;
        label =
          normalizeText($(sel).find(".ingred-tooltip-text").text()) || tag;
      }
      out.push({ tag, label });
    });
  return out;
}

function parseFullName($: Html): string | undefined {
  const raw = $("#compare-controls button[data-postlinkdata]").attr(
    "data-postlinkdata",
  );
  if (!raw) {
    return undefined;
  }
  try {
    const data = JSON.parse(raw) as { title?: string };
    return data.title ? normalizeText(data.title) : undefined;
  } catch {
    return undefined;
  }
}

function parseByFunction($: Html, baseUrl: string): Product["functions"] {
  const scope = $("#ingredlist-highlights-section");
  const key: IngredientsByFunction[] = [];
  const other: IngredientsByFunction[] = [];
  scope.find(".ingredlist-by-function-block").each((_, block) => {
    const $block = $(block);
    const heading = normalizeText(
      $block.find("h3").first().text(),
    ).toLowerCase();
    const target = heading.includes("other") ? other : key;
    $block.children("div").each((_, div) => {
      const $div = $(div);
      const $fn = $div.find("a.func-link").first();
      if (!$fn.length) {
        return;
      }
      const fnRef = refFromAnchor($, $fn, baseUrl) as FunctionRef;
      const ingredients: IngredientRef[] = [];
      $div.find("a.ingred-link").each((__, el) => {
        const ref = refFromAnchor($, el, baseUrl) as IngredientRef;
        const percent = extractPercent(ref.name);
        if (percent) {
          ref.percent = percent;
        }
        if (ref.slug) {
          ingredients.push(ref);
        }
      });
      if (fnRef.slug) {
        target.push({ function: fnRef, ingredients });
      }
    });
  });
  if (!key.length && !other.length) {
    return undefined;
  }
  return { key, other };
}

function parseSkimTable($: Html, baseUrl: string): SkimRow[] | undefined {
  const rows: SkimRow[] = [];
  $("#ingredlist-table-section table.product-skim tbody tr").each((_, tr) => {
    const $tr = $(tr);
    const $link = $tr.find("a.ingred-detail-link").first();
    if (!$link.length) {
      return;
    }
    const ingredient = refFromAnchor($, $link, baseUrl) as IngredientRef;
    const functions: FunctionRef[] = [];
    $tr.find("a.ingred-function-link").each((__, el) => {
      functions.push(refFromAnchor($, el, baseUrl) as FunctionRef);
    });
    let irritancy: string | undefined;
    let comedogenicity: string | undefined;
    $tr.find(".irrncom [class*='colorcode']").each((__, el) => {
      const title = $(el).attr("title") ?? "";
      const im = title.match(/irritancy:\s*(\S+)/i);
      const cm = title.match(/comedogenicity:\s*(\S+)/i);
      if (im) {
        irritancy = im[1];
      }
      if (cm) {
        comedogenicity = cm[1];
      }
    });
    const ourTake = ourTakeFromText($tr.find(".our-take").text());
    rows.push({ ingredient, functions, irritancy, comedogenicity, ourTake });
  });
  return rows.length ? rows : undefined;
}

function parseDates($: Html): Product["dates"] {
  const $scope = $(".prodinfobox, .prodnexttoimage").first();
  const times = $scope.find("time[datetime]");
  if (!times.length) {
    return undefined;
  }
  const uploadedAt = times.eq(0).attr("datetime") ?? undefined;
  const updatedAt =
    times.length > 1 ? (times.last().attr("datetime") ?? undefined) : undefined;
  let uploadedBy: string | undefined;
  $scope.find("div").each((_, div) => {
    const text = normalizeText($(div).text());
    const m = text.match(/Uploaded by:\s*(.+?)\s+on\s/i);
    if (m?.[1]) {
      uploadedBy = m[1];
      return false;
    }
    return true;
  });
  const dates: Product["dates"] = {};
  if (uploadedBy) {
    dates.uploadedBy = uploadedBy;
  }
  if (uploadedAt) {
    dates.uploadedAt = uploadedAt;
  }
  if (updatedAt && updatedAt !== uploadedAt) {
    dates.updatedAt = updatedAt;
  }
  return Object.keys(dates).length ? dates : undefined;
}

function parseTooltips($: Html, baseUrl: string): ProductTooltip[] {
  const out: ProductTooltip[] = [];
  $("span.tooltip_templates")
    .find("span[id]")
    .each((_, el) => {
      const $el = $(el);
      const id = $el.attr("id") ?? "";
      if (!id.startsWith("tt-") || id.startsWith("tt-hashtag-")) {
        return;
      }
      const slug = id.slice(3);
      if (!slug) {
        return;
      }
      const functions: FunctionRef[] = [];
      $el.find("a[href*='/ingredient-functions/']").each((__, a) => {
        functions.push(refFromAnchor($, a, baseUrl) as FunctionRef);
      });
      let irritancy: string | undefined;
      let comedogenicity: string | undefined;
      $el.find("[class*='colorcode']").each((__, cc) => {
        const title = $(cc).attr("title") ?? "";
        const im = title.match(/irritancy:\s*(\S+)/i);
        const cm = title.match(/comedogenicity:\s*(\S+)/i);
        if (im) {
          irritancy = im[1];
        }
        if (cm) {
          comedogenicity = cm[1];
        }
      });
      const blurb =
        normalizeText($el.find(".ingred-tooltip-text").text()) || undefined;
      out.push({ slug, functions, irritancy, comedogenicity, blurb });
    });
  return out;
}

function parseLongDescriptions(
  $: Html,
  baseUrl: string,
): IngredientLongEntry[] {
  const out: IngredientLongEntry[] = [];
  $("#ingredlist-long-section .ingred-long").each((_, el) => {
    const $el = $(el);
    const $hdr = $el.find(".ingred-header").first();
    const $link = $hdr.find("a").first();
    if (!$link.length) {
      return;
    }
    const ingredient = refFromAnchor($, $link, baseUrl) as IngredientRef;
    const ourTake = ourTakeFromText($hdr.find(".ourtake").text());
    const alsoCalled = (() => {
      let val: string | undefined;
      $el.find(".ingredquickinfo .itemprop").each((__, ip) => {
        const label = normalizeText($(ip).find(".label").text()).toLowerCase();
        if (label.includes("also-called")) {
          val = normalizeText($(ip).find(".value").text()) || undefined;
          return false;
        }
        return true;
      });
      return val;
    })();
    const functions: FunctionRef[] = [];
    $el
      .find(".ingredquickinfo a[href*='/ingredient-functions/']")
      .each((__, a) => {
        functions.push(refFromAnchor($, a, baseUrl) as FunctionRef);
      });
    const description =
      normalizeText($el.find(".ingreddescbox").text()) || undefined;
    out.push({ ingredient, alsoCalled, functions, ourTake, description });
  });
  return out;
}
