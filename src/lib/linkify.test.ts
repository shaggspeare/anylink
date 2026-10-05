// Run: node --test src/lib/linkify.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { linkify, noteTitle } from "./linkify.ts";

const hrefs = (text: string) => linkify(text).filter((p) => p.href).map((p) => p.href);

test("finds scheme'd and bare links, trims prose punctuation", () => {
  assert.deepEqual(hrefs("see https://a.com/x, and example.org."), ["https://a.com/x", "https://example.org"]);
  assert.deepEqual(hrefs("(https://en.wikipedia.org/wiki/Foo_(bar))"), ["https://en.wikipedia.org/wiki/Foo_(bar)"]);
});

test("leaves emails, plain words and decimals alone", () => {
  assert.deepEqual(hrefs("mail me@site.com about v1.2 later"), []);
});

test("round-trips the text exactly", () => {
  const text = "a https://b.co c\nd e.io/f!";
  assert.equal(linkify(text).map((p) => p.text).join(""), text);
});

test("note title is the first non-empty line", () => {
  assert.equal(noteTitle("\n  Groceries \nmilk"), "Groceries");
  assert.equal(noteTitle("   "), "Note");
  assert.equal(noteTitle("x".repeat(200)).length, 120);
});
