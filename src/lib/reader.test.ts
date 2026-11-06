// Run: node --test src/lib/reader.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { clockLabel, minutesLabel, readableParagraphs } from "./reader.ts";

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

test("recipe times and video lengths read the same as on iOS", () => {
  assert.deepEqual([5, 45, 60, 75, 135].map((m) => minutesLabel(m)), ["5 min", "45 min", "1 h", "1 h 15 min", "2 h 15 min"]);
  assert.deepEqual([7, 253, 3600, 7262].map(clockLabel), ["0:07", "4:13", "1:00:00", "2:01:02"]);
});
