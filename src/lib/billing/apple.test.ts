// Run: node --test src/lib/billing/apple.test.ts
// Offline: the notification and purchase tests stub Apple's verifier; the real one is only fed data it rejects (or,
// for Xcode, never checks) before any network call.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { VerificationException, VerificationStatus } from "@apple/app-store-server-library";
import { appleVerifier, handleNotification, PRODUCTS, purchaseEvent, type Verifier } from "./apple.ts";
import type { PlanEvent } from "../plan";

const USER = "0b6f4a1e-9c2d-4f7a-8e3b-5d1c2a9f7e60";
const OTHER = "7f3e2d1c-0b9a-4c8d-9e7f-6a5b4c3d2e1f";
const bought = Date.UTC(2026, 10, 1);
const expires = Date.UTC(2026, 11, 1);
const grace = Date.UTC(2026, 11, 17);
const refunded = Date.UTC(2026, 10, 9);

/** The stub's "signed" data is plain JSON: verifying it is parsing it. */
const stub = (fail?: VerificationStatus): Verifier => ({
  verifyAndDecodeNotification: async (p) => {
    if (fail !== undefined) throw new VerificationException(fail);
    return JSON.parse(p);
  },
  verifyAndDecodeTransaction: async (t) => JSON.parse(t),
  verifyAndDecodeRenewalInfo: async (r) => JSON.parse(r),
});

const tx = (fields: object = {}) =>
  JSON.stringify({ productId: PRODUCTS.monthly, appAccountToken: USER, purchaseDate: bought, expiresDate: expires, ...fields });
const notification = (notificationType: string, data: object = {}, subtype?: string) =>
  JSON.stringify({ notificationType, subtype, data: { signedTransactionInfo: tx(), ...data } });
const renewal = JSON.stringify({ gracePeriodExpiresDate: grace });

async function deliver(payload: string, verifier: Verifier | null = stub()) {
  const applied: [string, PlanEvent][] = [];
  const status = await handleNotification(payload, async (userId, event) => void applied.push([userId, event]), () => verifier);
  return { status, applied };
}

const monthly = PRODUCTS.monthly;
const grant = (until: number, product: string = monthly): PlanEvent => ({
  kind: "grant",
  product,
  until: new Date(until),
  purchasedAt: new Date(bought),
});
const end = (covered: number | null, at: number, product: string = monthly): PlanEvent => ({
  kind: "end",
  product,
  covered: covered === null ? null : new Date(covered),
  at: new Date(at),
});

test("notifications: each handled type updates the account in appAccountToken", async () => {
  const table: [string, string, PlanEvent][] = [
    ["subscribed", notification("SUBSCRIBED", {}, "INITIAL_BUY"), grant(expires)],
    ["renewed", notification("DID_RENEW"), grant(expires)],
    ["auto-renew turned off", notification("DID_CHANGE_RENEWAL_STATUS", {}, "AUTO_RENEW_DISABLED"), grant(expires)],
    ["upgraded", notification("DID_CHANGE_RENEWAL_PREF", { signedTransactionInfo: tx({ productId: PRODUCTS.yearly }) }, "UPGRADE"), grant(expires, PRODUCTS.yearly)],
    ["billing failed, in grace", notification("DID_FAIL_TO_RENEW", { signedRenewalInfo: renewal }, "GRACE_PERIOD"), grant(grace)],
    ["expired", notification("EXPIRED", {}, "VOLUNTARY"), end(expires, expires)],
    ["grace ran out", notification("GRACE_PERIOD_EXPIRED", { signedRenewalInfo: renewal }), end(grace, grace)],
    ["refunded", notification("REFUND", { signedTransactionInfo: tx({ revocationDate: refunded }) }), end(expires, refunded)],
    ["family sharing revoked", notification("REVOKE", { signedTransactionInfo: tx({ revocationDate: refunded }) }), end(expires, refunded)],
    [
      "lifetime refunded",
      notification("REFUND", { signedTransactionInfo: tx({ productId: PRODUCTS.lifetime, expiresDate: undefined, revocationDate: refunded }) }),
      end(null, refunded, PRODUCTS.lifetime),
    ],
  ];
  for (const [why, payload, event] of table) {
    const { status, applied } = await deliver(payload);
    assert.equal(status, 200, why);
    assert.deepEqual(applied, [[USER, event]], why);
  }
});

test("notifications: a reversed refund grants Pro as of now", async () => {
  const before = Date.now();
  const { applied } = await deliver(notification("REFUND_REVERSED"));
  const [[userId, event]] = applied;
  assert.equal(userId, USER);
  assert.equal(event.kind, "grant");
  assert.ok(event.kind === "grant" && event.purchasedAt.getTime() >= before);
});

test("notifications: other types, missing data and foreign products are a 200 that changes nothing", async () => {
  const table: [string, string][] = [
    ["a type nobody acts on", notification("PRICE_INCREASE", {}, "PENDING")],
    ["a test notification", JSON.stringify({ notificationType: "TEST" })],
    ["billing failed with no grace period", notification("DID_FAIL_TO_RENEW")],
    ["bought without an account token", notification("DID_RENEW", { signedTransactionInfo: tx({ appAccountToken: undefined }) })],
    ["a token that isn't a user id", notification("DID_RENEW", { signedTransactionInfo: tx({ appAccountToken: "not-a-uuid" }) })],
    ["another app's product", notification("DID_RENEW", { signedTransactionInfo: tx({ productId: "com.example.coins" }) })],
  ];
  for (const [why, payload] of table) assert.deepEqual(await deliver(payload), { status: 200, applied: [] }, why);
});

test("notifications: unverified is a 403, an unreachable revocation check a 503, a failed write throws", async () => {
  assert.deepEqual(await deliver(notification("DID_RENEW"), stub(VerificationStatus.VERIFICATION_FAILURE)), { status: 403, applied: [] });
  assert.deepEqual(await deliver(notification("DID_RENEW"), stub(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)), { status: 503, applied: [] });
  assert.deepEqual(await deliver(notification("DID_RENEW"), null), { status: 403, applied: [] });
  const failing = handleNotification(notification("DID_RENEW"), async () => { throw new Error("database down"); }, () => stub());
  await assert.rejects(failing, /database down/);
});

test("purchases: only the account in appAccountToken gets Pro", async () => {
  const verify = () => stub();
  assert.deepEqual(await purchaseEvent(tx(), USER, verify), grant(expires));
  assert.deepEqual(await purchaseEvent(tx(), USER.toUpperCase(), verify), grant(expires), "token case doesn't matter");
  assert.equal(await purchaseEvent(tx(), OTHER, verify), "account");
  assert.equal(await purchaseEvent(tx({ appAccountToken: undefined }), USER, verify), "account");
  assert.equal(await purchaseEvent(tx({ productId: "com.example.coins" }), USER, verify), "product");
  assert.equal(await purchaseEvent(tx({ expiresDate: undefined }), USER, verify), "product", "a subscription needs an expiry");
  assert.deepEqual(
    await purchaseEvent(tx({ productId: PRODUCTS.lifetime, expiresDate: undefined }), USER, verify),
    { kind: "grant", product: PRODUCTS.lifetime, until: null, purchasedAt: new Date(bought) }
  );
  assert.deepEqual(await purchaseEvent(tx({ revocationDate: refunded }), USER, verify), end(expires, refunded));
  const tampered: Verifier = { ...stub(), verifyAndDecodeTransaction: async () => { throw new VerificationException(VerificationStatus.VERIFICATION_FAILURE); } };
  assert.equal(await purchaseEvent(tx(), USER, () => tampered), "invalid");
  assert.equal(await purchaseEvent(tx(), USER, () => null), "environment");
});

/** A JWS shaped like a StoreKit transaction, with `chain` in its header and a signature nobody made. */
function forged(environment: string, chain: string[] = []) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const payload = {
    transactionId: "2000000000000001",
    originalTransactionId: "2000000000000001",
    bundleId: "com.shaggspeare.anylink",
    productId: PRODUCTS.lifetime,
    purchaseDate: bought,
    originalPurchaseDate: bought,
    quantity: 1,
    type: "Non-Consumable",
    appAccountToken: USER,
    inAppOwnershipType: "PURCHASED",
    signedDate: bought,
    environment,
  };
  return `${part({ alg: "ES256", x5c: chain })}.${part(payload)}.${Buffer.from("not a signature").toString("base64url")}`;
}

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  for (const [k, v] of Object.entries(vars)) if (v === undefined) delete process.env[k];
  return run().finally(() => {
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  });
}

test("the real verifier: which environments are accepted", () =>
  withEnv({ APPLE_APP_ID: undefined, APP_STORE_ALLOW_XCODE: undefined }, async () => {
    assert.ok(appleVerifier(forged("Sandbox")), "Sandbox always");
    assert.equal(appleVerifier(forged("Production")), null, "Production needs APPLE_APP_ID");
    assert.equal(appleVerifier(forged("Xcode")), null, "Xcode needs APP_STORE_ALLOW_XCODE=1");
    assert.equal(appleVerifier(forged("LocalTesting")), null);
    assert.equal(appleVerifier("garbage"), null);
    await withEnv({ APPLE_APP_ID: "6740000000", APP_STORE_ALLOW_XCODE: "1" }, async () => {
      assert.ok(appleVerifier(forged("Production")));
      // Nothing checks Xcode's signature: that's why it needs the flag, which production never sets.
      assert.deepEqual(await purchaseEvent(forged("Xcode"), USER), {
        kind: "grant",
        product: PRODUCTS.lifetime,
        until: null,
        purchasedAt: new Date(bought),
      });
    });
  }));

test("the real verifier: a forged Sandbox transaction is refused, even with Apple's root as its chain", async () => {
  const root = readFileSync("src/lib/billing/apple-roots/AppleRootCA-G3.cer").toString("base64");
  const refused = async (jws: string, status: VerificationStatus) => {
    await assert.rejects(appleVerifier(jws)!.verifyAndDecodeTransaction(jws), (e: VerificationException) => e.status === status);
    assert.equal(await purchaseEvent(jws, USER), "invalid");
  };
  // Apple's root is no App Store signing certificate, so the chain fails before any revocation check goes online.
  await refused(forged("Sandbox", [root, root, root]), VerificationStatus.VERIFICATION_FAILURE);
  // The library reports a short chain as INVALID_CERTIFICATE too.
  await refused(forged("Sandbox", [root]), VerificationStatus.INVALID_CERTIFICATE);
  await refused(forged("Sandbox", ["bm90", "YSBj", "ZXJ0"]), VerificationStatus.INVALID_CERTIFICATE);
});
