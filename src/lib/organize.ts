import type { Collection, LinkItem } from "./types";

/** Ordering, tag suggestions and theme detection — the three things that decide how a
 * library arranges itself. Pure functions so `organize.test.ts` can run them on node. */

export type Sort = "newest" | "oldest" | "title" | "site" | "manual";

export const SORT_LABELS: Record<Sort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  title: "Title A–Z",
  site: "Site A–Z",
  manual: "My order",
};

const newestFirst = (a: LinkItem, b: LinkItem) => b.createdAt.localeCompare(a.createdAt);

/** Manual order is one `position` per link with newest-first as the tie-break, so links
 * nobody has dragged yet keep the default ordering instead of collapsing into a heap. */
export function sortLinks(links: LinkItem[], sort: Sort): LinkItem[] {
  return [...links].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "site":
        return a.domain.localeCompare(b.domain) || newestFirst(a, b);
      case "manual":
        return (a.position ?? 0) - (b.position ?? 0) || newestFirst(a, b);
      case "oldest":
        return newestFirst(b, a);
      default:
        return newestFirst(a, b);
    }
  });
}

/** Drop `dragId` onto the slot `overId` currently occupies — the whole drag-and-drop model. */
export function moveBefore(ids: string[], dragId: string, overId: string): string[] {
  const from = ids.indexOf(dragId);
  const to = ids.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, dragId);
  return next;
}

/** Tags worth offering for a page: whatever the crawler pulled out of its metadata,
 * then any tag already in the library that the page's own words mention. */
export function suggestTags(
  crawled: string[],
  libraryTags: string[],
  text: string,
  limit = 8
): string[] {
  const haystack = text.toLowerCase();
  const mentioned = libraryTags.filter((t) => haystack.includes(t.toLowerCase()));
  return Array.from(new Set([...crawled, ...mentioned].map((t) => t.trim()).filter(Boolean))).slice(
    0,
    limit
  );
}

const MIN_THEME_LINKS = 3;

export type Theme = { name: string; query: string; count: number };

/** A tag that enough links share is a theme worth its own collection. Offered as a smart
 * collection (`#tag`) so it keeps filling itself; anything already saved drops out. */
export function suggestThemes(
  links: LinkItem[],
  collections: Collection[],
  limit = 4
): Theme[] {
  const taken = new Set(
    collections.flatMap((c) => [c.name.toLowerCase(), (c.smartQuery ?? "").toLowerCase()])
  );
  const counts = new Map<string, number>();
  for (const link of links) {
    if (link.archived) continue;
    for (const tag of link.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(
      ([tag, n]) =>
        n >= MIN_THEME_LINKS && !taken.has(tag.toLowerCase()) && !taken.has(`#${tag.toLowerCase()}`)
    )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({
      name: tag.charAt(0).toUpperCase() + tag.slice(1),
      query: `#${tag}`,
      count,
    }));
}
