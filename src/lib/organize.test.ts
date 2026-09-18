// Run: node --test src/lib/organize.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { moveBefore, sortLinks, suggestTags, suggestThemes } from "./organize.ts";
import type { Collection, LinkItem } from "./types.ts";

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
  link({ id: "a", title: "Bauhaus type", domain: "zed.com", tags: ["design"], position: 2 }),
  link({ id: "b", title: "Ambient css", domain: "alpha.com", tags: ["design", "css"], createdAt: "2025-01-01T10:00:00.000Z" }),
  link({ id: "c", title: "Colour theory", domain: "mid.com", tags: ["design"], position: 1 }),
  link({ id: "d", title: "Dead", tags: ["css"], archived: true }),
];

const ids = (sort: Parameters<typeof sortLinks>[1]) => sortLinks(library, sort).map((l) => l.id);

test("sorts by date, title and site", () => {
  assert.deepEqual(ids("newest"), ["a", "c", "d", "b"]);
  assert.deepEqual(ids("oldest"), ["b", "a", "c", "d"]);
  assert.deepEqual(ids("title"), ["b", "a", "c", "d"]);
  assert.deepEqual(ids("site"), ["b", "d", "c", "a"]);
});

test("manual order puts dragged links first, undragged fall back to newest", () => {
  // b and d never moved (position 0), so they lead — newest of the two first.
  assert.deepEqual(ids("manual"), ["d", "b", "c", "a"]);
});

test("moveBefore drops a card onto the slot it was dragged over", () => {
  assert.deepEqual(moveBefore(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  assert.deepEqual(moveBefore(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(moveBefore(["a", "b", "c"], "a", "a"), ["a", "b", "c"]);
  assert.deepEqual(moveBefore(["a", "b", "c"], "a", "zz"), ["a", "b", "c"]);
});

test("tag suggestions merge crawler keywords with the library's own vocabulary", () => {
  const suggested = suggestTags(["typography"], ["design", "css", "pasta"], "A CSS grid guide for design work");
  assert.deepEqual(suggested, ["typography", "design", "css"]);
  assert.deepEqual(suggestTags([], [], "nothing"), []);
});

test("themes come from shared tags and skip collections that already exist", () => {
  const collections: Collection[] = [{ id: "c1", name: "Inbox", color: "#000" }];
  assert.deepEqual(suggestThemes(library, collections), [
    { name: "Design", query: "#design", count: 3 },
  ]);
  // Already saved as a smart collection → no longer suggested.
  const saved: Collection[] = [...collections, { id: "c2", name: "Design", color: "#000", isSmart: true, smartQuery: "#design" }];
  assert.deepEqual(suggestThemes(library, saved), []);
});
