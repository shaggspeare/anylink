// Run: node --test src/lib/crawler/check-link.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isParked } from "./check-link.ts";
import { NO_ANSWER, PARKED, isDeadStatus } from "../link-health.ts";

test("dead = gone, unreachable or parked — not merely refusing us", () => {
  for (const alive of [200, 206, 301, 302, 308]) {
    assert.equal(isDeadStatus(alive), false, `${alive} should read as alive`);
  }
  for (const dead of [NO_ANSWER, PARKED, 404, 410]) {
    assert.equal(isDeadStatus(dead), true, `${dead} should read as dead`);
  }
  // A bot wall or a bad afternoon isn't a dead link, and trashing those would lose
  // perfectly good pages. 402 is in here because seriouseats.com really does answer
  // a crawler with one, and it is a very much alive website.
  for (const unclear of [401, 402, 403, 429, 500, 503]) {
    assert.equal(isDeadStatus(unclear), false, `${unclear} shouldn't read as dead`);
  }
});

test("parking pages are recognised, real pages are not", () => {
  assert.ok(isParked(`<html><script src="//sedoparking.com/x.js"></script></html>`));
  assert.ok(isParked(`<h1>This domain is for sale</h1>`));
  assert.ok(isParked(`<title>Buy this domain</title>`), "case-insensitive");
  assert.equal(isParked(`<h1>How we sold our startup</h1><p>A long read.</p>`), false);
});
