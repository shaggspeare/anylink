// Run: node --test src/lib/plan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPro } from "./plan.ts";

test("only 'pro' is Pro: no account, no row or an unknown value is free", () => {
  assert.equal(isPro("pro"), true);
  for (const plan of ["free", null, undefined, "", "PRO", "team"]) assert.equal(isPro(plan), false, String(plan));
});
