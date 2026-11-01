// Run: node --test src/lib/library-merge.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { linkMatcher, matchCollection, mergeLinks, urlKey, type MergeFields } from "./library-merge.ts";

test("urlKey: one page, one key", () => {
  const same: [string, string, string][] = [
    ["https://www.example.com/a/", "http://example.com/a", "scheme, www and trailing slash"],
    ["https://Example.COM/a?utm_source=x&fbclid=y", "https://example.com/a", "host case and tracking params"],
    ["  https://example.com/a  ", "https://example.com/a", "surrounding spaces"],
    ["https://example.com/", "https://example.com", "the root"],
  ];
  for (const [a, b, why] of same) assert.equal(urlKey(a), urlKey(b), why);
  const different: [string, string, string][] = [
    ["https://example.com/A", "https://example.com/a", "path case"],
    ["https://example.com/a?id=1", "https://example.com/a?id=2", "a real query"],
    ["https://example.com/a#one", "https://example.com/a#two", "the fragment"],
    ["https://example.com:8080/a", "https://example.com/a", "the port"],
    ["https://m.example.com/a", "https://example.com/a", "another subdomain"],
  ];
  for (const [a, b, why] of different) assert.notEqual(urlKey(a), urlKey(b), why);
  assert.equal(urlKey("not a url"), "not a url");
});

const row = (id: string, url: string, contentType = "article", clientId: string | null = null) => ({ id, url, contentType, clientId });

test("linkMatcher: by uploaded id, by own id, then by URL; notes and images by id only", () => {
  const m = linkMatcher([
    row("s1", "https://example.com/a", "article", "L1"),
    row("s2", "https://example.com/b"),
    row("s3", "", "note", "L3"),
    row("s4", "https://cdn.example.com/s4.webp", "image"),
    row("s5", "https://example.com/b"),
  ]);
  const table: [{ id: string; url: string; contentType: string }, string | undefined, string][] = [
    [{ id: "L1", url: "https://other.com", contentType: "article" }, "s1", "its client id wins over its URL"],
    [{ id: "s2", url: "", contentType: "note" }, "s2", "came down in a lapse: its id is the row's"],
    [{ id: "L9", url: "http://www.example.com/b/", contentType: "video" }, "s2", "same page; the first row wins"],
    [{ id: "L3", url: "", contentType: "note" }, "s3", "a note uploaded before"],
    [{ id: "L8", url: "", contentType: "note" }, undefined, "a new note"],
    [{ id: "L7", url: "https://cdn.example.com/s4.webp", contentType: "image" }, undefined, "images never match by URL"],
    [{ id: "L6", url: "https://example.com/new", contentType: "article" }, undefined, "a new page"],
  ];
  for (const [link, want, why] of table) assert.equal(m.match(link), want, why);

  m.add("s6", { id: "L6", url: "https://example.com/new", contentType: "article" });
  assert.equal(m.match({ id: "L5", url: "https://example.com/new/", contentType: "article" }), "s6", "a twin in one upload");
  assert.equal(m.match({ id: "L6", url: "", contentType: "article" }), "s6", "the next upload of the same link");
});

const link = (fields: Partial<MergeFields> = {}): MergeFields => ({ tags: [], createdAt: "2026-05-01T00:00:00.000Z", ...fields });

test("mergeLinks: tags, highlights, notes, the earlier save, pinned and favourite", () => {
  const table: [MergeFields, MergeFields, Partial<MergeFields>, string][] = [
    [link({ tags: ["a", "b"] }), link({ tags: ["b", "c"] }), { tags: ["a", "b", "c"] }, "tags union"],
    [
      link({ highlights: [{ quote: "one", note: "mine" }] }),
      link({ highlights: [{ quote: "one" }, { quote: "two" }, { quote: "two" }] }),
      { highlights: [{ quote: "one", note: "mine" }, { quote: "two" }] },
      "highlights merge by quote",
    ],
    [link({ note: "web" }), link({ note: "phone" }), { note: "web\n\nphone" }, "different notes are appended"],
    [link({ note: "same" }), link({ note: " same " }), { note: "same" }, "equal notes stay one"],
    [link({ note: "web\n\nphone" }), link({ note: "phone" }), { note: "web\n\nphone" }, "appended before: unchanged"],
    [link({ note: "web" }), link({ note: "web\n\nphone" }), { note: "web\n\nphone" }, "the fuller note wins"],
    [link({ note: null }), link({ note: "phone" }), { note: "phone" }, "a note where there was none"],
    [link({ note: "web" }), link({}), { note: "web" }, "no note to add"],
    [
      link({ createdAt: "2026-05-01T00:00:00.000Z" }),
      link({ createdAt: "2025-01-02T03:04:05Z" }),
      { createdAt: "2025-01-02T03:04:05Z" },
      "the earlier save",
    ],
    [link({ createdAt: "2025-01-01T00:00:00.000Z" }), link({ createdAt: "2026-01-01T00:00:00Z" }), { createdAt: "2025-01-01T00:00:00.000Z" }, "kept earlier"],
    [link({ pinned: false, favorite: true }), link({ pinned: true, favorite: false }), { pinned: true, favorite: true }, "either side's flags"],
  ];
  for (const [into, from, want, why] of table) {
    const merged = mergeLinks(into, from);
    for (const [key, value] of Object.entries(want)) assert.deepEqual(merged[key as keyof MergeFields], value, why);
    assert.deepEqual(mergeLinks(merged, from), merged, `${why}: merging again changes nothing`);
  }
});

test("mergeLinks keeps every other field of the copy merged into", () => {
  const merged = mergeLinks({ ...link(), title: "Web title", collectionId: "c1" }, { ...link(), title: "Phone title" } as MergeFields);
  assert.equal(merged.title, "Web title");
  assert.equal(merged.collectionId, "c1");
});

test("matchCollection: the inbox, then smart by name and query, then by name", () => {
  const existing = [
    { id: "inbox", name: "Unsorted", isInbox: true },
    { id: "read", name: "Reading " },
    { id: "vid", name: "Videos", isSmart: true, smartQuery: "type:video" },
  ];
  const table: [{ name: string; isSmart?: boolean; smartQuery?: string; isInbox?: boolean }, string | undefined, string][] = [
    [{ name: "Inbox", isInbox: true }, "inbox", "the inbox, whatever it's called"],
    [{ name: "reading" }, "read", "case and spaces don't count"],
    [{ name: "Unsorted" }, undefined, "a collection named like the inbox isn't the inbox"],
    [{ name: "Videos", isSmart: true, smartQuery: "type:video" }, "vid", "same name and query"],
    [{ name: "Videos", isSmart: true, smartQuery: "type:recipe" }, undefined, "another query"],
    [{ name: "Videos" }, undefined, "a collection isn't a smart collection"],
  ];
  for (const [c, want, why] of table) assert.equal(matchCollection(c, existing)?.id, want, why);
});
