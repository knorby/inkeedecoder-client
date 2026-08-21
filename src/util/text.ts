/**
 * Text normalization helpers. inkeedecoder.com ingredient names embed zero-width
 * characters (e.g. "Caprylic/​Capric" contains U+200B after the slash) that
 * must be stripped before comparing or storing names.
 */

import type { OurTake } from "../types.js";

const ZERO_WIDTH = /\u200b|\u200c|\u200d|\ufeff/g;
const WHITESPACE = /\s+/g;

/** Collapse whitespace and strip zero-width characters. */
export function normalizeText(input: string | null | undefined): string {
  if (!input) {
    return "";
  }
  return input.replace(ZERO_WIDTH, "").replace(WHITESPACE, " ").trim();
}

/** Extract a percentage (e.g. "1.0", without the percent sign) from a display string, if present. */
export function extractPercent(input: string): string | undefined {
  const match = input.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return match?.[1]?.replace(",", ".");
}

/** Strip surrounding typographic quotes around a description. */
export function stripQuotes(input: string): string {
  let s = input.trim();
  // Match a matching pair of straight/smart double quotes around the whole string.
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if (first === `"` && last === `"`) {
      s = s.slice(1, -1);
    } else if (first === "\u201c" && last === "\u201d") {
      s = s.slice(1, -1);
    }
  }
  return s.trim();
}

/** Parse an INKEEDecoder "our-take" CSS class into a rating. */
export function ourTakeFromClass(classList: string): OurTake | undefined {
  if (classList.includes("our-take-superstar")) {
    return "superstar";
  }
  if (classList.includes("our-take-goodie")) {
    return "goodie";
  }
  if (classList.includes("our-take-icky")) {
    return "icky";
  }
  return undefined;
}

/** Parse a "our-take" span's text (e.g. "goodie", "- goodie"). */
export function ourTakeFromText(input: string): OurTake | undefined {
  const t = normalizeText(input).replace(/^-\s*/, "").toLowerCase();
  if (t === "superstar" || t === "goodie" || t === "icky") {
    return t;
  }
  return undefined;
}
