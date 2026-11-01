// explicit extensions so `node --test src/lib/export.test.ts` resolves this without a bundler
import { isHttpUrl } from "./import/parse.ts";
import type { Collection, LinkItem } from "./types.ts";

/** What an export holds: the library as `getLibraryData` returns it, minus Trash. */
export type ExportLibrary = { links: LinkItem[]; collections: Collection[] };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Both quotes too: `parseBookmarks` reads an attribute up to the first of either. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

function bookmark(link: LinkItem): string {
  const added = Math.floor(Date.parse(link.createdAt) / 1000);
  const attrs = [`HREF="${escapeHtml(link.url)}"`];
  if (Number.isFinite(added)) attrs.push(`ADD_DATE="${added}"`);
  if (link.tags.length) attrs.push(`TAGS="${escapeHtml(link.tags.join(","))}"`);
  return `<DT><A ${attrs.join(" ")}>${escapeHtml(link.title)}</A>`;
}

/** Netscape bookmark HTML, the file every browser imports. Each collection is a folder (`<H3>`); each link keeps
 * its saved date (`ADD_DATE`, in seconds) and its tags (`TAGS`, as Firefox writes them). Notes have no URL and
 * smart collections own no links, so neither is in it. Reads back through `parseBookmarks`. */
export function toBookmarksHtml({ links, collections }: ExportLibrary): string {
  const folders = collections.filter((c) => !c.isSmart);
  const filed = new Set(folders.map((c) => c.id));
  const pages = links.filter((l) => isHttpUrl(l.url));
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    ...folders.flatMap((c) => [
      `    <DT><H3>${escapeHtml(c.name)}</H3>`,
      "    <DL><p>",
      ...pages.filter((l) => l.collectionId === c.id).map((l) => `        ${bookmark(l)}`),
      "    </DL><p>",
    ]),
    // A link whose collection isn't listed still belongs in a backup.
    ...pages.filter((l) => !filed.has(l.collectionId)).map((l) => `    ${bookmark(l)}`),
    "</DL><p>",
    "",
  ].join("\n");
}

/** Everything, for a backup: every field of every collection and link (notes, tags, highlights, collection,
 * pinned, favourite, timestamps), as the apps have them. Compact, like `GET /api/v1/library`. */
export function toExportJson({ links, collections }: ExportLibrary, exportedAt: Date): string {
  return JSON.stringify({ format: "anylink", version: 1, exportedAt: exportedAt.toISOString(), collections, links });
}

const CSV_COLUMNS = ["url", "title", "collection", "tags", "note", "saved_at", "excerpt"];

/** RFC 4180: a field holding a comma, a quote or a line break goes in quotes, with its quotes doubled. */
function csvField(value: string): string {
  // Titles and excerpts come from any web page, and a cell starting with = + - or @ runs as a formula in a
  // spreadsheet. The leading ' keeps it text (OWASP's CSV injection advice).
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per link, notes included, for a spreadsheet. */
export function toCsv({ links, collections }: ExportLibrary): string {
  const names = new Map(collections.map((c) => [c.id, c.name]));
  const rows = links.map((l) => [
    l.url,
    l.title,
    names.get(l.collectionId) ?? "",
    l.tags.join(", "),
    l.note ?? "",
    l.createdAt,
    l.excerpt,
  ]);
  // The byte-order mark tells Excel the file is UTF-8; without it, a title in any other script reads as mojibake.
  return "\uFEFF" + [CSV_COLUMNS, ...rows].map((row) => row.map(csvField).join(",") + "\r\n").join("");
}
