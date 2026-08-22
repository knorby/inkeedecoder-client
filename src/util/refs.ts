/**
 * URL/path/slug helpers. Implemented without `URL` from a Node-vs-RN-runtime
 * standpoint: a tiny, dependency-free string joiner keeps the library safe for
 * React Native's Hermes runtime. Paths on inkeedecoder.com are always
 * site-relative ("/products/...").
 */

export function isAbsoluteUrl(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

/** Join a base URL with a site-relative or absolute path. */
export function joinUrl(baseUrl: string, path: string): string {
  if (!path) {
    return baseUrl;
  }
  if (isAbsoluteUrl(path)) {
    return path;
  }
  if (path.startsWith("//")) {
    return `https:${path}`;
  }
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Reduce any href (absolute URL, protocol-relative, or path) to a site path. */
export function parsePath(href: string): string {
  let h = href.trim();
  const m = h.match(/^https?:\/\/[^/]+(.*)$/i);
  if (m) {
    h = m[1] ?? "";
  } else if (h.startsWith("//")) {
    const rest = h.indexOf("/", 2); // strip "//host" leave "/..."
    h = rest === -1 ? "/" : h.slice(rest);
  }
  h = h.split("?")[0]?.split("#")[0] ?? "";
  if (h && !h.startsWith("/")) {
    h = `/${h}`;
  }
  return h;
}

/** First path segment (entity type): "products", "ingredients", "brands", ... */
export function pathType(path: string): string | undefined {
  const segs = path.split("/").filter(Boolean);
  return segs[0];
}

/** Last path segment (the slug). */
export function slugFromPath(path: string): string | undefined {
  const segs = path.split("/").filter(Boolean);
  return segs.length > 1 ? segs[segs.length - 1] : segs[0];
}

/**
 * Normalize a caller-supplied entity id (slug, path, or absolute URL) to a
 * `{ slug, path }` pair for the given entity type. A bare slug is prefixed
 * with `/{type}/`; an already-typed path/URL is left intact.
 */
export function normalizeEntityId(
  id: string,
  type: string,
): { slug: string; path: string } {
  let p = id.trim();
  if (isAbsoluteUrl(p)) {
    p = parsePath(p); // strips origin + query/hash
  } else {
    p = p.split("?")[0]?.split("#")[0] ?? ""; // strip query/hash
  }
  if (!p.startsWith("/")) {
    p = `/${p}`;
  }
  const segs = p.split("/").filter(Boolean);
  if (segs.length === 0) {
    return { slug: "", path: `/${type}` };
  }
  // Bare slug (no type prefix).
  if (segs.length === 1) {
    return { slug: segs[0] ?? "", path: `/${type}/${segs[0]}` };
  }
  const slug = segs[segs.length - 1] ?? "";
  return { slug, path: p };
}

/** Number-matching delay helper (no Node timers needed beyond globalThis). */
export function delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}
