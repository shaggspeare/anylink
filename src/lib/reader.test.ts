// Run: node --test src/lib/reader.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { readableParagraphs } from "./reader.ts";

const sentence = "This is a real sentence with more than eight words in it.";

test("scraped chrome falls back to the excerpt", () => {
  assert.deepEqual(
    readableParagraphs(["English", "Down chevron icon", "© 2026 Instagram from Meta"], "Studio profile"),
    ["Studio profile"]
  );
});

test("real prose is kept, short headings included", () => {
  const article = ["Introduction", sentence, sentence, sentence, sentence];
  assert.deepEqual(readableParagraphs(article, "x"), article);
});

test("no text and no excerpt shows nothing", () => {
  assert.deepEqual(readableParagraphs(undefined, ""), []);
});
