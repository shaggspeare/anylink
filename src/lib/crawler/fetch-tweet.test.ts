import { test } from "node:test";
import assert from "node:assert/strict";
import { tweetId, tweetToken } from "./fetch-tweet.ts";

test("tweetId reads post URLs on x.com and twitter.com, and nothing else", () => {
  assert.equal(tweetId("https://x.com/naval/status/1002103360646823936?s=20"), "1002103360646823936");
  assert.equal(tweetId("https://twitter.com/naval/status/1002103360646823936/photo/1"), "1002103360646823936");
  assert.equal(tweetId("https://mobile.twitter.com/i/web/status/1002103360646823936"), "1002103360646823936");
  assert.equal(tweetId("https://x.com/naval"), null);
  assert.equal(tweetId("https://example.com/status/123"), null);
  assert.equal(tweetId("not a url"), null);
});

test("tweetToken matches the embed script's derivation", () => {
  // The formula the embed script uses, checked against its own output for this id.
  assert.equal(tweetToken("1002103360646823936"), "2fg77x4z3zo");
});
