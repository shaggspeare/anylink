// Run: node --test src/lib/search.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { searchLinks } from "./search.ts";
import type { LinkItem } from "./types.ts";

function link(partial: Partial<LinkItem> & { id: string }): LinkItem {
  return {
    url: `https://example.com/${partial.id}`,
    domain: "example.com",
    title: "Untitled",
    excerpt: "",
    tint: "#fff",
    stripe: "#000",
    initial: "E",
    contentType: "article",
    collectionId: "c1",
    tags: [],
    size: "M",
    status: "ready",
    createdAt: "2026-03-04T10:00:00.000Z",
    ...partial,
  };
}

const library: LinkItem[] = [
  link({ id: "a", title: "CSS grid guide", tags: ["design", "css"], favorite: true }),
  link({ id: "b", title: "Superman review", contentType: "video", excerpt: "a film about css" }),
  link({ id: "c", title: "Pasta recipe", note: "try the css of cooking", createdAt: "2025-11-02T10:00:00.000Z" }),
  link({ id: "d", title: "Dead page", httpStatus: 404 }),
  link({ id: "e", title: "Dupe one", url: "https://dup.com/x/" }),
  link({ id: "f", title: "Dupe two", url: "https://DUP.com/x" }),
  link({ id: "g", title: "Old news", archived: true }),
];

const ids = (query: string) => searchLinks(library, query).map((l) => l.id);

test("bare words match across every field, archived stays hidden", () => {
  assert.deepEqual(ids("css"), ["a", "b", "c"]);
  assert.deepEqual(ids(""), ["a", "b", "c", "d", "e", "f"]);
});

test("quoted phrase, exclusion, and field scoping", () => {
  assert.deepEqual(ids('"css grid"'), ["a"]);
  assert.deepEqual(ids("css -superman"), ["a", "c"]);
  assert.deepEqual(ids("title:css"), ["a"]);
  assert.deepEqual(ids("note:css"), ["c"]);
  assert.deepEqual(ids("link:dup"), ["e", "f"]);
});

test("tags match by prefix and can be excluded", () => {
  assert.deepEqual(ids("#des"), ["a"]);
  assert.deepEqual(ids("css -#design"), ["b", "c"]);
});

test("terms are ANDed unless match:or is present", () => {
  assert.deepEqual(ids("grid pasta"), []);
  assert.deepEqual(ids("grid pasta match:or"), ["a", "c"]);
  // c has "css" in its note, so a note hit counts as a plain-text hit
  assert.deepEqual(ids("css pasta"), ["c"]);
});

test("type, flags, and dates", () => {
  assert.deepEqual(ids("type:video"), ["b"]);
  assert.deepEqual(ids("is:favorite"), ["a"]);
  assert.deepEqual(ids("is:noted"), ["c"]);
  assert.deepEqual(ids("is:untagged"), ["b", "c", "d", "e", "f"]);
  assert.deepEqual(ids("is:duplicate"), ["e", "f"]);
  assert.deepEqual(ids("is:broken"), ["d"]);
  assert.deepEqual(ids("is:archived"), ["g"]);
  assert.deepEqual(ids("created:2025-11"), ["c"]);
  assert.deepEqual(ids("created:>2026-01-01"), ["a", "b", "d", "e", "f"]);
});
