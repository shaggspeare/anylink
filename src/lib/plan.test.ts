// Run: node --test src/lib/plan.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fullCrawl,
  isPro,
  LIFETIME_FAIR_USE,
  planAfter,
  PRO_REQUIRED,
  proAware,
  type PlanEvent,
  type PlanRow,
  type StoredPlan,
} from "./plan.ts";

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

test("fullCrawl: Pro gets AI and the browser, except lifetime past its fair use this month", () => {
  const table: [PlanRow | null, number, boolean, string][] = [
    [null, 0, false, "signed out"],
    [{ plan: "free" }, 0, false, "free"],
    [{ plan: "pro", planExpiresAt: later }, 5000, true, "subscriptions have no cap"],
    [{ plan: "pro", planExpiresAt: earlier }, 0, false, "lapsed subscription"],
    [{ plan: "pro", planExpiresAt: null }, LIFETIME_FAIR_USE - 1, true, "lifetime under the cap"],
    [{ plan: "pro", planExpiresAt: null }, LIFETIME_FAIR_USE, false, "lifetime at the cap"],
    [{ plan: "pro" }, LIFETIME_FAIR_USE + 1, false, "grandfathered past the cap"],
    [{ plan: "pro", planExpiresAt: later }, LIFETIME_FAIR_USE, true, "a sandbox lifetime ends within a week, so no cap"],
  ];
  for (const [row, links, expected, why] of table) assert.equal(fullCrawl(row, links, now), expected, why);
});

test("proAware: any action's Pro refusal calls back, and every answer passes through", async () => {
  let refusals = 0;
  const api = proAware(
    {
      setShared: async (on: boolean) => (on ? PRO_REQUIRED : { shareToken: null }),
      later: async () => ({ ok: false, reason: "pro" }),
      pin: async () => ({ ok: false }),
      nothing: async () => undefined,
    },
    () => refusals++
  );
  assert.deepEqual(await api.setShared(false), { shareToken: null });
  assert.deepEqual(await api.pin(), { ok: false });
  assert.equal(await api.nothing(), undefined);
  assert.equal(refusals, 0);
  assert.deepEqual(await api.setShared(true), PRO_REQUIRED);
  await api.later();
  assert.equal(refusals, 2);
});

test("planAfter: purchases and App Store news, each scenario a run of events", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 10, d));
  type From = PlanEvent["from"];
  type Grant = Extract<PlanEvent, { kind: "grant" }>;
  // The account's purchases: lifetime "L" (refunds recorded under L), and subscription "M" with transactions m1, m2…
  // (refunds recorded per transaction). "X" belongs to someone else, sent here under a token they chose.
  const lifetime = (from: From = "app", purchase = "L"): Grant => ({
    from, purchase, refundKey: purchase, product: "lifetime", signedAt: day(1).getTime(), kind: "grant", until: null, purchasedAt: day(1),
  });
  const sub = (tx: string, until: number, bought: number, from: From = "app", product = "monthly", purchase = "M"): Grant => ({
    from, purchase, refundKey: tx, product, signedAt: day(bought).getTime(), kind: "grant", until: day(until), purchasedAt: day(bought),
  });
  const expired = (tx: string, until: number, purchase = "M"): PlanEvent => ({
    from: "apple", purchase, refundKey: tx, product: "monthly", signedAt: day(until).getTime(), kind: "end", covered: day(until), at: day(until),
  });
  const refunded = (key: string, at: number, covered: number | null = null, purchase = covered ? "M" : key): PlanEvent => ({
    from: "apple", purchase, refundKey: key, product: covered ? "monthly" : "lifetime", signedAt: day(at).getTime(),
    kind: "end", covered: covered ? day(covered) : null, at: day(at), refund: true,
  });
  const reversed = (at: number): PlanEvent => ({ ...lifetime("apple"), signedAt: day(at).getTime(), reversal: true });

  const row = (plan: string, planProduct: string | null, until: number | null, planTransaction: string | null, planRevoked: string[] = []): StoredPlan => ({
    plan, planProduct, planExpiresAt: until === null ? null : day(until), planTransaction, planRevoked,
  });
  const free = row("free", null, null, null);
  const grandfathered = row("pro", null, null, null);
  const onLifetime = row("pro", "lifetime", null, "L");
  const onMonthly = (until: number) => row("pro", "monthly", until, "M");
  const log = (key: string, word: string, d: number) => `${key}:${word}:${day(d).getTime()}`;

  const table: [string, StoredPlan, PlanEvent[], StoredPlan][] = [
    // Buying, renewing, lapsing
    ["first subscription", free, [sub("m1", 10, 1)], onMonthly(10)],
    ["lifetime", free, [lifetime()], onLifetime],
    ["grandfathered keeps lifetime", grandfathered, [sub("m1", 10, 1), lifetime()], grandfathered],
    ["lifetime ignores a subscription", onLifetime, [sub("m1", 10, 1)], onLifetime],
    ["renewal, from Apple", onMonthly(10), [sub("m2", 20, 10, "apple")], onMonthly(20)],
    ["an older renewal never shortens Pro", onMonthly(20), [sub("m1", 10, 1, "apple")], onMonthly(20)],
    ["upgrade within the group: same purchase", onMonthly(10), [sub("m2", 300, 5, "apple", "yearly")], row("pro", "yearly", 300, "M")],
    ["subscriber buys lifetime", onMonthly(10), [lifetime()], onLifetime],
    ["grace period", onMonthly(10), [sub("m1", 14, 1, "apple")], onMonthly(14)],
    ["expired", onMonthly(10), [expired("m1", 10)], row("free", "monthly", 10, "M")],
    ["a stale expiry after a renewal", onMonthly(20), [expired("m1", 10)], onMonthly(20)],
    ["the lapsed subscription, sent again", row("free", "monthly", 10, "M"), [sub("m1", 10, 1)], row("free", "monthly", 10, "M")],
    ["resubscribed: same purchase, new money", row("free", "monthly", 10, "M"), [sub("m3", 30, 12)], onMonthly(30)],
    ["lifetime that arrived late", row("free", "monthly", 10, "M"), [lifetime()], onLifetime],
    ["a sandbox lifetime never shortens real Pro", onMonthly(30), [{ ...lifetime(), product: "sandbox:lifetime", until: day(8) }], onMonthly(30)],

    // Refunds (H1): a refunded purchase never grants again, whatever the account holds meanwhile
    ["subscription refunded", onMonthly(10), [refunded("m1", 5, 10)], row("free", "monthly", 5, "M", [log("m1", "refunded", 5)])],
    ["lifetime refunded", onLifetime, [refunded("L", 5)], row("free", "lifetime", 5, "L", [log("L", "refunded", 5)])],
    [
      "refunded lifetime, then any monthly, then the lifetime's old receipt",
      onLifetime,
      [refunded("L", 5), sub("m9", 3, 2), lifetime()],
      row("pro", "monthly", 3, "M", [log("L", "refunded", 5)]),
    ],
    ["refunded before it was ever posted", free, [refunded("L", 5), lifetime()], row("free", null, null, null, [log("L", "refunded", 5)])],
    ["the refunded subscription period, sent again", onMonthly(10), [refunded("m1", 5, 10), sub("m1", 10, 1)], row("free", "monthly", 5, "M", [log("m1", "refunded", 5)])],
    ["bought again after a refund: a new purchase", row("free", "lifetime", 5, "L", [log("L", "refunded", 5)]), [lifetime("app", "L2")], row("pro", "lifetime", null, "L2", [log("L", "refunded", 5)])],
    ["grandfathered can't be refunded away", grandfathered, [refunded("L", 5)], row("pro", null, null, null, [log("L", "refunded", 5)])],

    // A refund and its reversal, in either order (L2): the one Apple signed later wins
    ["refund, then its reversal", onLifetime, [refunded("L", 5), reversed(9)], row("pro", "lifetime", null, "L", [log("L", "reversed", 9)])],
    ["a reversal that arrives before its refund", onLifetime, [reversed(9), refunded("L", 5)], row("pro", "lifetime", null, "L", [log("L", "reversed", 9)])],
    ["refunded again after the reversal", onLifetime, [refunded("L", 5), reversed(9), refunded("L", 12)], row("free", "lifetime", 12, "L", [log("L", "refunded", 12)])],
    ["a stale reversal after the second refund", onLifetime, [refunded("L", 5), refunded("L", 12), reversed(9)], row("free", "lifetime", 12, "L", [log("L", "refunded", 12)])],

    // Apple's news only touches the purchase the account is on (M1)
    ["another purchase's renewal is ignored", onMonthly(10), [sub("x1", 40, 5, "apple", "monthly", "X")], onMonthly(10)],
    ["another purchase's expiry is ignored", onMonthly(20), [expired("x1", 10, "X")], onMonthly(20)],
    ["another purchase's refund only goes on the log", onMonthly(20), [refunded("x1", 5, 10, "X")], row("pro", "monthly", 20, "M", [log("x1", "refunded", 5)])],
    ["lifetime outlives the subscription it replaced", onLifetime, [expired("m1", 10)], onLifetime],
    ["Apple's news before the app's post, then the post", free, [sub("m1", 30, 1, "apple"), sub("m1", 30, 1)], onMonthly(30)],
  ];
  for (const [why, start, events, expected] of table) {
    assert.deepEqual(events.reduce((r, e) => planAfter(r, e) ?? r, start), expected, why);
  }
  // A stale refund is a no-op, not a rewrite.
  assert.equal(planAfter(row("pro", "lifetime", null, "L", [log("L", "reversed", 9)]), refunded("L", 5)), null);
  // The refunded lifetime's old receipt grants nothing, even after a monthly purchase moved the account on.
  const lapsedMonthly = [refunded("L", 5), sub("m9", 3, 2), lifetime()].reduce((r, e) => planAfter(r, e) ?? r, onLifetime);
  assert.equal(isPro(lapsedMonthly, day(10)), false);
});
