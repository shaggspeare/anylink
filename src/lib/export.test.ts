// Run: node --test src/lib/export.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { toBookmarksHtml, toCsv, toExportJson } from "./export.ts";
import { parseBookmarks } from "./import/parse.ts";
import type { Collection, LinkItem } from "./types.ts";

function link(fields: Partial<LinkItem> & Pick<LinkItem, "id" | "url" | "title" | "collectionId">): LinkItem {
  return {
    domain: "example.com",
    excerpt: "",
    tint: "#9aa3ad",
    stripe: "#ffffff",
    initial: "E",
    contentType: "article",
    tags: [],
    size: "M",
    status: "ready",
    createdAt: "2026-10-01T12:00:00.000Z",
    ...fields,
  };
}

const collections: Collection[] = [
  { id: "inbox", name: "Unsorted", color: "#9aa3ad", isInbox: true },
  { id: "rust", name: "Rust & <Go> / \"systems\"", color: "#7c8cff", createdBy: "user", shareToken: "tok" },
  { id: "empty", name: "Empty", color: "#d6f24b" },
  { id: "videos", name: "Videos", color: "#17181b", isSmart: true, smartQuery: "type:video" },
];

const links: LinkItem[] = [
  link({
    id: "book",
    url: "https://doc.rust-lang.org/book/?a=1&b='2'",
    title: `The "Book" & <friends>`,
    collectionId: "rust",
    tags: ["rust", "docs"],
    note: "Read it twice, then\nonce more",
    highlights: [{ id: "h1", quote: "ownership", note: "key" }],
    pinned: true,
    favorite: true,
    archived: true,
    readingTimeMinutes: 12,
    articleText: ["One.", "Two."],
    createdAt: "2026-09-30T08:15:00.000Z",
  }),
  link({ id: "wiki", url: "https://en.wikipedia.org/wiki/Hitchhiker's_Guide", title: "Hitchhiker’s Guide", collectionId: "inbox" }),
  link({ id: "note", url: "", domain: "", title: "Groceries", excerpt: "eggs, milk", contentType: "note", collectionId: "inbox" }),
  link({ id: "evil", url: "https://evil.example/", title: "=HYPERLINK(\"https://evil.example\",\"x\")", collectionId: "inbox" }),
  link({ id: "lost", url: "https://lost.example/", title: "No collection", collectionId: "deleted-collection" }),
];

const library = { links, collections };

test("bookmark HTML re-parses to the same URLs, folders, titles and dates", () => {
  const parsed = parseBookmarks(toBookmarksHtml(library));
  assert.deepEqual(
    parsed.map((l) => [l.url, l.meta.folder, l.title, l.meta.savedAt]),
    [
      ["https://en.wikipedia.org/wiki/Hitchhiker's_Guide", "Unsorted", "Hitchhiker’s Guide", "2026-10-01T12:00:00.000Z"],
      ["https://evil.example/", "Unsorted", `=HYPERLINK("https://evil.example","x")`, "2026-10-01T12:00:00.000Z"],
      ["https://doc.rust-lang.org/book/?a=1&b='2'", `Rust & <Go> / "systems"`, `The "Book" & <friends>`, "2026-09-30T08:15:00.000Z"],
      // Its collection isn't listed, so it sits at the top level rather than going missing.
      ["https://lost.example/", undefined, "No collection", "2026-10-01T12:00:00.000Z"],
    ]
  );
});

test("bookmark HTML: tags in TAGS, empty collections kept as folders, no smart collections or notes", () => {
  const html = toBookmarksHtml(library);
  assert.match(html, /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
  assert.match(html, /ADD_DATE="1790756100" TAGS="rust,docs">/);
  assert.match(html, /<H3>Empty<\/H3>/);
  assert.doesNotMatch(html, /Videos|Groceries/);
});

test("CSV quotes commas, quotes and line breaks per RFC 4180, and defuses formulas", () => {
  const csv = toCsv(library);
  assert.ok(csv.startsWith("\uFEFFurl,title,collection,tags,note,saved_at,excerpt\r\n"));
  const rows = csv.slice(1).split("\r\n");
  assert.equal(rows.length, links.length + 2, "a header, a row per link, and a final line break");
  assert.equal(
    rows[1],
    `https://doc.rust-lang.org/book/?a=1&b='2',"The ""Book"" & <friends>","Rust & <Go> / ""systems""","rust, docs","Read it twice, then\nonce more",2026-09-30T08:15:00.000Z,`
  );
  assert.equal(rows[3], `,Groceries,Unsorted,,,2026-10-01T12:00:00.000Z,"eggs, milk"`);
  assert.equal(rows[4].split(",")[1], `"'=HYPERLINK(""https://evil.example""`);
  assert.equal(rows[5], "https://lost.example/,No collection,,,,2026-10-01T12:00:00.000Z,");
});

test("JSON keeps every field of every link and collection", () => {
  const json = JSON.parse(toExportJson(library, new Date("2026-11-01T09:30:00Z")));
  assert.deepEqual(json, {
    format: "anylink",
    version: 1,
    exportedAt: "2026-11-01T09:30:00.000Z",
    collections,
    links,
  });
});
