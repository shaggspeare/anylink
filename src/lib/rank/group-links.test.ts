// Run: node --test src/lib/rank/group-links.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByMetadata, merge, type GroupInput } from "./group-links.ts";

const link = (i: number, domain: string, note?: string): GroupInput => ({
  i,
  title: `Link ${i}`,
  domain,
  note,
});

test("fallback: folders beat domains, thin groups pool together", () => {
  const collections = groupByMetadata([
    link(0, "example.com", "Bookmarks bar / Reading / Rust"),
    link(1, "docs.rs", "Bookmarks bar / Reading / Rust"),
    link(2, "blog.dev", "Bookmarks bar / Reading / Rust"),
    link(3, "youtube.com"),
    link(4, "youtube.com"),
    link(5, "youtube.com"),
    link(6, "lonely.example"),
  ]);

  assert.deepEqual(
    collections.map((c) => [c.name, c.indices]),
    [
      ["Rust", [0, 1, 2]],
      ["youtube.com", [3, 4, 5]],
      ["Everything else", [6]],
    ]
  );
  assert.ok(collections[0].reasoning.length > 0);
});

test("merge: the same name from two batches is one collection, best rank wins", () => {
  const merged = merge([
    [{ name: "Rust async", reasoning: "a", indices: [1, 2], rank: 3 }],
    [
      { name: "rust  Async", reasoning: "b", indices: [7], rank: 1 },
      { name: "Recipes", reasoning: "c", indices: [8], rank: 2 },
    ],
  ]);

  assert.equal(merged.length, 2);
  // Rank 1 sorts first and is the rank the merged collection keeps.
  assert.deepEqual(merged[0], { name: "Rust async", reasoning: "a", indices: [1, 2, 7], rank: 1 });
  assert.equal(merged[1].name, "Recipes");
});
