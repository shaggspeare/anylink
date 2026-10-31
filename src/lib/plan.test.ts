// Run: node --test src/lib/plan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { isPro, planAfter, type PlanEvent, type PlanRow, type StoredPlan } from "./plan.ts";

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

test("planAfter: purchases and App Store events, stale ones changing nothing", () => {
  const [monthly, yearly, lifetime] = ["monthly", "yearly", "lifetime"];
  const day = (d: number) => new Date(Date.UTC(2026, 10, d));
  const row = (plan: string, planProduct: string | null, planExpiresAt: Date | null): StoredPlan => ({
    plan,
    planProduct,
    planExpiresAt,
  });
  const grant = (product: string, until: Date | null, purchasedAt = day(1)): PlanEvent => ({
    kind: "grant",
    product,
    until,
    purchasedAt,
  });
  const end = (product: string, covered: Date | null, at: Date): PlanEvent => ({ kind: "end", product, covered, at });
  const free = row("free", null, null);
  const grandfathered = row("pro", null, null);

  const table: [StoredPlan, PlanEvent, StoredPlan | null, string][] = [
    [free, grant(monthly, day(10)), row("pro", monthly, day(10)), "first subscription"],
    [free, grant(lifetime, null), row("pro", lifetime, null), "lifetime"],
    [grandfathered, grant(monthly, day(10)), null, "grandfathered keeps lifetime"],
    [grandfathered, grant(lifetime, null), null, "grandfathered buying lifetime stays grandfathered"],
    [row("pro", lifetime, null), grant(yearly, day(20)), null, "lifetime ignores a subscription"],
    [row("pro", monthly, day(10)), grant(monthly, day(20)), row("pro", monthly, day(20)), "renewal"],
    [row("pro", monthly, day(20)), grant(monthly, day(10)), null, "an older renewal never shortens Pro"],
    [row("pro", monthly, day(10)), grant(yearly, day(28)), row("pro", yearly, day(28)), "upgrade to yearly"],
    [row("pro", monthly, day(10)), grant(lifetime, null), row("pro", lifetime, null), "subscriber buys lifetime"],
    [row("pro", monthly, day(10)), grant(monthly, day(14)), row("pro", monthly, day(14)), "grace period"],
    [row("pro", monthly, day(10)), end(monthly, day(10), day(10)), row("free", monthly, day(10)), "expired"],
    [row("pro", monthly, day(14)), end(monthly, day(14), day(14)), row("free", monthly, day(14)), "grace ran out"],
    [row("pro", monthly, day(20)), end(monthly, day(10), day(10)), null, "a stale expiry after a renewal"],
    [row("pro", monthly, day(10)), end(monthly, day(10), day(5)), row("free", monthly, day(5)), "refund"],
    [row("pro", yearly, day(28)), end(monthly, day(10), day(5)), null, "refund of a product Pro no longer comes from"],
    [row("pro", lifetime, null), end(monthly, day(10), day(10)), null, "lifetime outlives a subscription"],
    [row("pro", lifetime, null), end(lifetime, null, day(5)), row("free", lifetime, day(5)), "lifetime refunded"],
    [grandfathered, end(lifetime, null, day(5)), null, "grandfathered can't be refunded away"],
    [row("free", lifetime, day(5)), grant(lifetime, null, day(1)), null, "the refunded purchase, sent again"],
    [row("free", lifetime, day(5)), grant(lifetime, null, day(6)), row("pro", lifetime, null), "bought again"],
    [row("free", monthly, day(10)), grant(monthly, day(10), day(1)), null, "the lapsed subscription, sent again"],
    [row("free", monthly, day(10)), grant(monthly, day(30), day(12)), row("pro", monthly, day(30)), "resubscribed"],
    [row("free", monthly, day(10)), grant(lifetime, null, day(1)), row("pro", lifetime, null), "lifetime that arrived late"],
  ];
  for (const [before, event, expected, why] of table) assert.deepEqual(planAfter(before, event), expected, why);
});
