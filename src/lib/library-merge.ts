// Explicit extension so `node --test` resolves it without a bundler.
import { cleanUrl } from "./crawler/url.ts";

/** How the upgrade (`uploadLibrary`) folds a local library into a server library, and the rule iOS's lapse uses the
 * other way (`LibraryRules` in AnyLinkKit): links match by URL, or by the id they were uploaded under, and two copies of
 * one link merge so nothing either side had is lost. Running it again changes nothing. */

/** One page, one key: tracking parameters, the scheme, a leading "www." and trailing slashes don't make a new URL.
 * Anything that isn't a URL is its own key. iOS's twin is `LibraryRules.urlKey`. */
export function urlKey(raw: string): string {
  try {
    const u = new URL(cleanUrl(raw.trim()));
    return u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + u.search + u.hash;
  } catch {
    return raw.trim();
  }
}

type Matchable = { id: string; url: string; contentType: string };

/** A link with a page behind it. Notes and images have no URL, so only their id can match them. */
const isPage = (l: Matchable) => l.contentType !== "note" && l.contentType !== "image" && l.url.trim() !== "";

/** Finds the link an uploaded one already is: the row it was uploaded as before (its id is that row's `client_id`), the
 * row it came down from in a lapse (its id is the row's id), or a page with the same `urlKey`. `add` records a new row,
 * so a second copy in the same upload joins it. The first of two rows with one URL wins. */
export function linkMatcher(rows: (Matchable & { clientId?: string | null })[]) {
  const byId = new Map<string, string>();
  const byUrl = new Map<string, string>();
  const add = (id: string, l: Matchable & { clientId?: string | null }) => {
    for (const key of [l.id, l.clientId]) if (key && !byId.has(key)) byId.set(key, id);
    if (isPage(l) && !byUrl.has(urlKey(l.url))) byUrl.set(urlKey(l.url), id);
  };
  for (const r of rows) add(r.id, r);
  return {
    match: (l: Matchable): string | undefined => byId.get(l.id) ?? (isPage(l) ? byUrl.get(urlKey(l.url)) : undefined),
    add,
  };
}

/** What merging changes. Everything else keeps the value of the copy merged into. */
export type MergeFields = {
  tags: string[];
  highlights?: { quote: string; note?: string }[];
  note?: string | null;
  /** ISO 8601. */
  createdAt: string;
  pinned?: boolean;
  favorite?: boolean;
};

/** One link from two libraries, as one: `from`'s tags and highlights (by quote) join `into`'s, its note is appended
 * unless one note already holds the other, the earlier save wins, and pinned or favourite on either side stays on. */
export function mergeLinks<T extends MergeFields>(into: T, from: MergeFields): T {
  const highlights = [...(into.highlights ?? [])];
  for (const h of from.highlights ?? []) if (!highlights.some((x) => x.quote === h.quote)) highlights.push(h);
  return {
    ...into,
    tags: [...new Set([...into.tags, ...from.tags])],
    highlights,
    note: mergeNotes(into.note, from.note),
    createdAt: Date.parse(from.createdAt) < Date.parse(into.createdAt) ? from.createdAt : into.createdAt,
    pinned: Boolean(into.pinned || from.pinned),
    favorite: Boolean(into.favorite || from.favorite),
  };
}

function mergeNotes(into?: string | null, from?: string | null): string | undefined {
  const a = into?.trim() || undefined;
  const b = from?.trim() || undefined;
  if (!b || a?.includes(b)) return a;
  if (!a || b.includes(a)) return b;
  return `${a}\n\n${b}`;
}

type CollectionKey = { name: string; isSmart?: boolean | null; smartQuery?: string | null; isInbox?: boolean | null };

/** Where an uploaded collection lands: the inbox in the inbox, a smart collection on one with the same name and query,
 * any other on one with the same name. Names match ignoring case and surrounding spaces. */
export function matchCollection<C extends CollectionKey>(c: CollectionKey, existing: C[]): C | undefined {
  const name = c.name.trim().toLowerCase();
  return existing.find((e) =>
    c.isInbox
      ? e.isInbox
      : !e.isInbox &&
        Boolean(e.isSmart) === Boolean(c.isSmart) &&
        e.name.trim().toLowerCase() === name &&
        (!c.isSmart || (e.smartQuery ?? "") === (c.smartQuery ?? ""))
  );
}
