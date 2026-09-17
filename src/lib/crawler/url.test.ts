// Run: node --test src/lib/crawler/url.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanUrl, titleFromUrl, failureFor } from "./url.ts";

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

test("failureFor gives the form something to show", () => {
  const f = failureFor("https://shop.com/p/blue-wool-coat?utm_source=x", "blocked");
  assert.equal(f.domain, "shop.com");
  assert.equal(f.suggestedTitle, "Blue wool coat");
  assert.equal(f.reason, "blocked");
  assert.ok(f.tint && f.initial);
});
