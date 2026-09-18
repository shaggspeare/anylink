import { isBrokenStatus } from "./link-health.ts";
import type { LinkItem } from "./types";

/** One query language for the ⌘K palette, the sidebar filters, the library view and
 * smart collections — every filter in the UI is just a query string this parses, so
 * there's nothing to keep in sync when a new filter shows up. */

export type Flag = "favorite" | "noted" | "untagged" | "duplicate" | "broken" | "archived";
const FLAGS: Flag[] = ["favorite", "noted", "untagged", "duplicate", "broken", "archived"];

type Term =
  | { kind: "text"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "field"; field: "title" | "excerpt" | "note" | "link"; value: string }
  | { kind: "type"; value: string }
  | { kind: "flag"; value: Flag }
  | { kind: "created"; op: "=" | "<" | ">"; value: string };

export type ParsedQuery = {
  include: Term[];
  exclude: Term[];
  /** `match:or` — positive terms match any instead of all. Exclusions always apply. */
  anyOf: boolean;
};

// A quoted run (optionally behind `-` and/or a `field:`) or a bare run of non-spaces.
const TOKEN = /-?(?:[a-z]+:)?"[^"]*"|\S+/gi;

export function parseQuery(input: string): ParsedQuery {
  const query: ParsedQuery = { include: [], exclude: [], anyOf: false };

  for (const raw of input.match(TOKEN) ?? []) {
    let token = raw;
    const negated = token.startsWith("-");
    if (negated) token = token.slice(1);
    if (!token) continue;

    if (token.toLowerCase() === "match:or") {
      query.anyOf = true;
      continue;
    }

    const term = toTerm(token);
    if (term) (negated ? query.exclude : query.include).push(term);
  }

  return query;
}

function toTerm(token: string): Term | null {
  if (token.startsWith("#")) {
    const value = unquote(token.slice(1)).toLowerCase();
    return value ? { kind: "tag", value } : null;
  }

  const colon = token.indexOf(":");
  if (colon > 0) {
    const field = token.slice(0, colon).toLowerCase();
    const value = unquote(token.slice(colon + 1)).toLowerCase();
    if (value) {
      if (field === "title" || field === "excerpt" || field === "note" || field === "link") {
        return { kind: "field", field, value };
      }
      if (field === "type") return { kind: "type", value };
      if (field === "is" && (FLAGS as string[]).includes(value)) {
        return { kind: "flag", value: value as Flag };
      }
      if (field === "created") {
        const op = value[0] === "<" || value[0] === ">" ? (value[0] as "<" | ">") : "=";
        const date = op === "=" ? value : value.slice(1);
        return date ? { kind: "created", op, value: date } : null;
      }
    }
    // Unknown prefix (a bare `https://…`, say) falls through to plain text.
  }

  const value = unquote(token).toLowerCase();
  return value ? { kind: "text", value } : null;
}

function unquote(value: string) {
  return value.startsWith('"') && value.endsWith('"') && value.length > 1
    ? value.slice(1, -1)
    : value;
}

export function isBroken(link: LinkItem) {
  return isBrokenStatus(link.httpStatus);
}

/** Same page saved twice: compare URLs ignoring the trailing slash and case. */
function urlKey(link: LinkItem) {
  return link.url.replace(/\/+$/, "").toLowerCase();
}

export function duplicateIdsIn(links: LinkItem[]): Set<string> {
  const byKey = new Map<string, string[]>();
  for (const link of links) {
    const key = urlKey(link);
    const ids = byKey.get(key);
    if (ids) ids.push(link.id);
    else byKey.set(key, [link.id]);
  }
  return new Set(Array.from(byKey.values()).filter((ids) => ids.length > 1).flat());
}

function matchTerm(link: LinkItem, term: Term, duplicates: Set<string>): boolean {
  switch (term.kind) {
    case "text": {
      const haystack = [
        link.title,
        link.excerpt,
        link.domain,
        link.url,
        link.note ?? "",
        ...link.tags,
        ...(link.articleText ?? []),
      ]
        .join("\n")
        .toLowerCase();
      return haystack.includes(term.value);
    }
    // Prefix, not exact: `#des` should narrow to `design` while you're still typing it.
    case "tag":
      return link.tags.some((t) => t.toLowerCase().startsWith(term.value));
    case "field": {
      const source =
        term.field === "title"
          ? link.title
          : term.field === "excerpt"
            ? link.excerpt
            : term.field === "note"
              ? link.note ?? ""
              : `${link.domain} ${link.url}`;
      return source.toLowerCase().includes(term.value);
    }
    case "type":
      return link.contentType === term.value;
    case "flag":
      switch (term.value) {
        case "favorite":
          return Boolean(link.favorite);
        case "noted":
          return Boolean(link.note?.trim());
        case "untagged":
          return link.tags.length === 0;
        case "duplicate":
          return duplicates.has(link.id);
        case "broken":
          return isBroken(link);
        case "archived":
          return Boolean(link.archived);
      }
    case "created": {
      const date = link.createdAt.slice(0, 10);
      if (term.op === ">") return date > term.value;
      if (term.op === "<") return date < term.value;
      return date.startsWith(term.value);
    }
  }
}

export function matchLink(link: LinkItem, query: ParsedQuery, duplicates: Set<string>): boolean {
  // Archived links stay out of every view unless the query asks for them by name.
  const wantsArchived = [...query.include, ...query.exclude].some(
    (t) => t.kind === "flag" && t.value === "archived"
  );
  if (link.archived && !wantsArchived) return false;

  if (query.exclude.some((t) => matchTerm(link, t, duplicates))) return false;
  if (query.include.length === 0) return true;

  return query.anyOf
    ? query.include.some((t) => matchTerm(link, t, duplicates))
    : query.include.every((t) => matchTerm(link, t, duplicates));
}

export function searchLinks(links: LinkItem[], input: string): LinkItem[] {
  const query = parseQuery(input);
  const duplicates = query.include
    .concat(query.exclude)
    .some((t) => t.kind === "flag" && t.value === "duplicate")
    ? duplicateIdsIn(links)
    : new Set<string>();
  return links.filter((l) => matchLink(l, query, duplicates));
}
