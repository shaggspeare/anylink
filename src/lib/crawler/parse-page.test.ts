// Run: node --test src/lib/crawler/parse-page.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHtml } from "./parse-page.ts";

const filler = "Plenty of words here so Readability treats this as the article body. ".repeat(8);

test("article body keeps lists, headings and code, decodes entities, no duplicates", () => {
  const html = `<html><head><title>T</title></head><body><article>
    <h1>T</h1>
    <p>${filler}</p>
    <h2>Setup &amp; config</h2>
    <p>It&#8217;s ${filler}</p>
    <ul><li>first item</li><li><p>second item</p></li></ul>
    <pre>const a = 1;
const b = 2;</pre>
    <blockquote><p>quoted line</p></blockquote>
    <p>${filler}</p>
  </article></body></html>`;

  const { articleText } = parseHtml(html, "https://example.com/post");

  assert.ok(articleText.includes("Setup & config"));
  assert.ok(articleText.some((p) => p.startsWith("It’s ")));
  assert.ok(articleText.includes("first item"));
  assert.equal(articleText.filter((p) => p === "second item").length, 1);
  assert.ok(articleText.includes("const a = 1;\nconst b = 2;"));
  assert.equal(articleText.filter((p) => p === "quoted line").length, 1);
});

test("review counts come out whole: 1.2K is 1200, not 1.2", () => {
  const ld = (count: string) => `<html><head><title>P</title><script type="application/ld+json">${JSON.stringify({
    "@type": "Product", name: "P", aggregateRating: { ratingValue: "4.5", reviewCount: count },
  })}</script></head><body><p>${filler}</p></body></html>`;
  assert.equal(parseHtml(ld("1.2K"), "https://shop.example/p").product?.reviewCount, 1200);
  assert.equal(parseHtml(ld("1,234 reviews"), "https://shop.example/p").product?.reviewCount, 1234);
});
