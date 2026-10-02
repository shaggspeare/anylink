// Run: node --test src/lib/card-identity.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { identityForDomain, legibleStripe } from "./card-identity.ts";

test("the initial is never drawn in the tile's own colour", () => {
  for (let i = 0; i < 500; i++) {
    const { tint, stripe } = identityForDomain(`site-${i}.com`);
    assert.notEqual(stripe, tint, `site-${i}.com`);
  }
});

test("stored rows with a clashing stripe are repaired", () => {
  assert.equal(legibleStripe("#d6f24b", "#d6f24b"), "#17181b");
  assert.equal(legibleStripe("#17181b", "#17181b"), "#ffffff");
  assert.equal(legibleStripe("#ff5a1f", "#ffffff"), "#ffffff");
});
