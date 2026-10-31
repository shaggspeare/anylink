// Run: node --test src/lib/plan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPro, type PlanRow } from "./plan.ts";

const now = new Date("2026-11-15T12:00:00Z");
const later = new Date("2026-12-15T12:00:00Z");
const earlier = new Date("2026-10-15T12:00:00Z");

test("isPro: plan 'pro' with no expiry or one still ahead", () => {
  const table: [PlanRow | string | null | undefined, boolean, string][] = [
    [{ plan: "pro", planExpiresAt: null }, true, "lifetime or grandfathered"],
    [{ plan: "pro" }, true, "no expiry column read"],
    [{ plan: "pro", planExpiresAt: later }, true, "subscription still running"],
    [{ plan: "pro", planExpiresAt: earlier }, false, "subscription lapsed"],
    [{ plan: "pro", planExpiresAt: now }, false, "expires this instant"],
    [{ plan: "free", planExpiresAt: null }, false, "free"],
    [{ plan: "free", planExpiresAt: later }, false, "free, whatever the date says"],
    [{ plan: null }, false, "no plan"],
    [{ plan: "PRO", planExpiresAt: null }, false, "unknown value"],
    ["pro", true, "the library's plan string"],
    ["free", false, "free string"],
    [null, false, "no account"],
    [undefined, false, "no row"],
    ["", false, "empty"],
    ["team", false, "unknown string"],
  ];
  for (const [plan, expected, why] of table) assert.equal(isPro(plan, now), expected, why);
});
