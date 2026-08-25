/**
 * HTML parsing layer — the single place that touches an HTML library.
 *
 * Runtime dependencies are `htmlparser2` (parser), `css-select` (selector
 * engine), `domutils` (attribute/text helpers), and `domhandler` (node
 * types). This is the same parser + selector stack cheerio/slim wraps,
 * minus cheerio itself — which removes cheerio's heavy transitive tree
 * (`parse5`, `undici`, `whatwg-*`) from installed dependencies, keeping the
 * bundle React-Native/Metro-safe and the supply-chain surface small.
 *
 * The exported {@link Html} API mirrors the small subset of cheerio's
 * jQuery-like API this package actually uses; behavior parity is pinned by
 * `tests/html.test.ts` plus the offline fixture suite. If richer semantics
 * are ever needed, extend the adapter here — do not import HTML libraries
 * elsewhere.
 */
import { is as matches, selectAll } from "css-select";
import type { AnyNode, Document, Element } from "domhandler";
import { isTag, isText } from "domhandler";
import { getAttributeValue, getText } from "domutils";
import { parseDocument } from "htmlparser2";
import type { Ref } from "./types.js";
import { joinUrl, parsePath, slugFromPath } from "./util/refs.js";
import { normalizeText } from "./util/text.js";

/**
 * Anything accepted by the query function: a CSS selector, raw DOM node(s)
 * (as delivered to `each` callbacks), or an existing selection.
 */
export type HtmlScope =
  | string
  | AnyNode
  | AnyNode[]
  | HtmlSelection
  | null
  | undefined;

/** A matched set of DOM nodes with cheerio-style traversal helpers. */
export interface HtmlSelection {
  /** Number of nodes in the set. */
  readonly length: number;
  /**
   * Attribute value of the first element in the set, or `undefined` when the
   * set is empty or the attribute is absent.
   */
  attr(name: string): string | undefined;
  /** Concatenated text of the whole set (including descendants). */
  text(): string;
  /**
   * Iterate the set with `(index, node)`; return `false` from the callback
   * to stop early. Callbacks receive raw DOM nodes. Chainable.
   */
  each(
    fn: (index: number, node: AnyNode) => boolean | undefined,
  ): HtmlSelection;
  /** First node of the set as a new selection. */
  first(): HtmlSelection;
  /** Last node of the set as a new selection. */
  last(): HtmlSelection;
  /** Node at `index` (empty selection when out of range). */
  eq(index: number): HtmlSelection;
  /** Descendants of every node in the set matching the selector. */
  find(selector: string): HtmlSelection;
  /** Direct child elements of every node in the set, optionally filtered. */
  children(selector?: string): HtmlSelection;
  /** Direct child nodes of every node in the set (text nodes included). */
  contents(): HtmlSelection;
  /** Sibling elements after every node in the set, optionally filtered. */
  nextAll(selector?: string): HtmlSelection;
  /**
   * Add the previous set in the chain back to the current one, optionally
   * filtered — supports the `$(scope).find("a").addBack("a")` pattern.
   */
  addBack(selector?: string): HtmlSelection;
}

/** Query function over a parsed document. */
export type Html = (selector: HtmlScope) => HtmlSelection;

class Selection implements HtmlSelection {
  constructor(
    // Internal on purpose: exposed only through HtmlSelection methods.
    readonly nodes: AnyNode[],
    private readonly prev?: AnyNode[],
  ) {}

  get length(): number {
    return this.nodes.length;
  }

  attr(name: string): string | undefined {
    for (const node of this.nodes) {
      if (isTag(node)) {
        return getAttributeValue(node, name) ?? undefined;
      }
    }
    return undefined;
  }

  text(): string {
    let out = "";
    for (const node of this.nodes) {
      out += isText(node) ? node.data : getText(node);
    }
    return out;
  }

  each(
    fn: (index: number, node: AnyNode) => boolean | undefined,
  ): HtmlSelection {
    let index = 0;
    for (const node of this.nodes) {
      if (fn(index++, node) === false) {
        break;
      }
    }
    return this;
  }

  first(): HtmlSelection {
    return new Selection(this.nodes.slice(0, 1));
  }

  last(): HtmlSelection {
    return this.eq(this.nodes.length - 1);
  }

  eq(index: number): HtmlSelection {
    const node = index >= 0 ? this.nodes[index] : undefined;
    return new Selection(node ? [node] : []);
  }

  find(selector: string): HtmlSelection {
    // Candidates are the *descendant* elements (never the set itself), so
    // find() matches descendants only, like cheerio. css-select's selectAll
    // searches each candidate's subtree; passing a pre-flattened candidate
    // list is safe because it de-duplicates overlapping roots first.
    const candidates = unique(flatMap(this.nodes, elementsUnder));
    return new Selection(selectAll(selector, candidates), this.nodes);
  }

  children(selector?: string): HtmlSelection {
    const kids = unique(
      flatMap(this.nodes, (node) =>
        "children" in node && node.children ? node.children.filter(isTag) : [],
      ),
    );
    return new Selection(filterMatches(kids, selector), this.nodes);
  }

  contents(): HtmlSelection {
    const kids = unique(
      flatMap(this.nodes, (node) =>
        "children" in node && node.children ? [...node.children] : [],
      ),
    );
    return new Selection(kids, this.nodes);
  }

  nextAll(selector?: string): HtmlSelection {
    const sibs: Element[] = [];
    for (const node of this.nodes) {
      const parent: AnyNode | null =
        "parent" in node ? (node.parent ?? null) : null;
      if (!parent || !("children" in parent) || !parent.children) continue;
      const idx = parent.children.indexOf(node);
      if (idx < 0) continue;
      for (const sibling of parent.children.slice(idx + 1)) {
        if (isTag(sibling)) {
          sibs.push(sibling);
        }
      }
    }
    return new Selection(filterMatches(unique(sibs), selector), this.nodes);
  }

  addBack(selector?: string): HtmlSelection {
    const prev = this.prev ?? [];
    // Filter element-by-element: the previous set members must match on
    // their own, not via their subtrees.
    const extra = selector
      ? prev.filter((node) => isTag(node) && matches(node, selector))
      : prev;
    return new Selection(unique([...this.nodes, ...extra]));
  }
}

/**
 * Keep elements that match `selector` themselves (subtrees are not searched),
 * mirroring cheerio's filter-by-selector semantics for traversal results.
 */
function filterMatches(elements: Element[], selector?: string): Element[] {
  if (!selector) {
    return elements;
  }
  return elements.filter((el) => matches(el, selector));
}

/** All descendant elements of `root`, in document order. */
function elementsUnder(root: AnyNode): Element[] {
  const out: Element[] = [];
  const walk = (node: AnyNode): void => {
    if (!("children" in node) || !node.children) return;
    for (const child of node.children) {
      if (isTag(child)) {
        out.push(child);
      }
      walk(child);
    }
  };
  walk(root);
  return out;
}

function flatMap<TIn, TOut>(items: TIn[], fn: (item: TIn) => TOut[]): TOut[] {
  const out: TOut[] = [];
  for (const item of items) {
    out.push(...fn(item));
  }
  return out;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function scopeToNodes(
  scope: Exclude<HtmlScope, string | null | undefined>,
): AnyNode[] {
  if (scope instanceof Selection) return [...scope.nodes];
  if (Array.isArray(scope)) return [...scope];
  // Selection is the only HtmlSelection implementation in this package and
  // was handled above; anything else claiming the interface cannot expose
  // its nodes, so treat it as a single node.
  return [scope as unknown as AnyNode];
}

/**
 * Parse an HTML string into a queryable root. Uses htmlparser2 defaults
 * (HTML mode, entity decoding) — the same parser settings cheerio/slim
 * applied, so parsed trees are identical for a given input.
 */
export function parseHtml(html: string): Html {
  const document: Document = parseDocument(html);
  const root = new Selection([document]);

  const $ = ((selector: HtmlScope): HtmlSelection => {
    if (!selector || typeof selector === "string") {
      return selector ? root.find(selector) : new Selection([]);
    }
    return new Selection(scopeToNodes(selector));
  }) as Html;

  return $;
}

/**
 * Build a {@link Ref} from an anchor element given the site base URL. Names are
 * normalized (zero-width characters stripped); the slug is derived from the href.
 */
export function refFromAnchor(
  $: Html,
  anchor: Exclude<HtmlScope, string>,
  baseUrl: string,
): Ref {
  const $a = $(anchor);
  const href = $a.attr("href") ?? "";
  const path = parsePath(href);
  const name = normalizeText($a.text());
  const slug = slugFromPath(path) ?? "";
  return { name, slug, path, url: joinUrl(baseUrl, path) };
}
