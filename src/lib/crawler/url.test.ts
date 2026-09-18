// Run: node --test src/lib/crawler/url.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanUrl, titleFromUrl, failureFor, looksBlocked, metadataFloor } from "./url.ts";

test("cleanUrl strips tracking params, keeps routing ones", () => {
  assert.equal(
    cleanUrl("https://shop.com/p/42?utm_source=ig&fbclid=abc&color=black"),
    "https://shop.com/p/42?color=black"
  );
  assert.equal(cleanUrl("https://shop.com/p/42?utm_campaign=x"), "https://shop.com/p/42");
  assert.equal(cleanUrl("https://shop.com/p/42#reviews"), "https://shop.com/p/42#reviews");
  assert.equal(cleanUrl("not a url"), "not a url");
});

test("titleFromUrl reads the slug, ignores id segments", () => {
  assert.equal(
    titleFromUrl("https://rozetka.com.ua/ua/apple-macbook-air-m4/p123456/"),
    "Apple macbook air m4"
  );
  assert.equal(titleFromUrl("https://blog.dev/2024/06/why-crawlers-fail.html"), "Why crawlers fail");
  assert.equal(titleFromUrl("https://example.com/"), "example.com");
  assert.equal(titleFromUrl("https://example.com/12345"), "example.com");
});

test("looksBlocked tells a bot wall from a thin but real page", () => {
  const page = { title: "How crawlers fail", excerpt: "", articleText: [], heroImage: undefined };
  assert.equal(looksBlocked({ ...page, title: "Just a moment...", excerpt: "x" }), true);
  assert.equal(looksBlocked({ ...page, title: "Access Denied", heroImage: "a.jpg" }), true);
  assert.equal(looksBlocked(page), true, "nothing extracted at all");
  assert.equal(looksBlocked({ ...page, heroImage: "hero.jpg" }), false);
  assert.equal(looksBlocked({ ...page, excerpt: "A summary." }), false);
  assert.equal(looksBlocked({ ...page, articleText: ["Body."] }), false);
});

test("metadataFloor builds a card out of the URL alone", () => {
  const r = metadataFloor("https://shop.com/p/blue-wool-coat?utm_source=x");
  assert.equal(r.domain, "shop.com");
  assert.equal(r.title, "Blue wool coat");
  assert.equal(r.canonicalUrl, "https://shop.com/p/blue-wool-coat");
  assert.deepEqual(r.articleText, []);
  assert.equal(r.excerptOnly, true);
  assert.ok(r.tint && r.initial);
});

test("failureFor gives the form something to show", () => {
  const f = failureFor("https://shop.com/p/blue-wool-coat?utm_source=x", "blocked");
  assert.equal(f.domain, "shop.com");
  assert.equal(f.suggestedTitle, "Blue wool coat");
  assert.equal(f.reason, "blocked");
  assert.ok(f.tint && f.initial);
});
