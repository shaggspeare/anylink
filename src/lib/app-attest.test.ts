// Run: node --test src/lib/app-attest.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  APPLE_ROOT_CA,
  challengeIsFresh,
  checkAssertion,
  checkAttestation,
  DAILY_CAPS,
  makeChallenge,
  spend,
} from "./app-attest.ts";

/** Real attestations and an assertion made on iPhones, so these run the checks against Apple's actual formats. */
const fixtures = JSON.parse(readFileSync(new URL("./app-attest.fixtures.json", import.meta.url), "utf8"));
const { appId, development, production, assertion: signed, otherRoot } = fixtures;
const attest = (f: { attestation: string; challenge: string; keyId: string }, overrides: Partial<typeof f> = {}, app = appId, root = APPLE_ROOT_CA) => {
  const { attestation, challenge, keyId } = { ...f, ...overrides };
  return checkAttestation(Buffer.from(attestation, "base64"), challenge, keyId, app, root);
};

test("Apple's development and production attestations register, each with its environment", () => {
  const dev = attest(development);
  assert.equal(dev.environment, "development");
  assert.match(dev.publicKey, /^-----BEGIN PUBLIC KEY-----/);
  assert.equal(attest(production).environment, "production");
});

test("an attestation is refused for another challenge, key, app or root", () => {
  assert.throws(() => attest(development, { challenge: production.challenge }), /nonce/);
  assert.throws(() => attest(development, { keyId: production.keyId }), /key id/);
  assert.throws(() => attest(development, {}, "376HNWM383.com.shaggspeare.anylink"), /app id/);
  assert.throws(() => attest(development, {}, appId, otherRoot), /certificate chain/);
});

test("garbage and truncated attestations throw instead of crashing", () => {
  const bytes = Buffer.from(development.attestation, "base64");
  for (const bad of [Buffer.alloc(0), Buffer.from("not cbor"), bytes.subarray(0, 900), Buffer.from([0x9b, 0xff])]) {
    assert.throws(() => checkAttestation(bad, development.challenge, development.keyId, appId));
  }
});

test("an assertion is accepted once, for its own body", () => {
  const check = (body: string, lastCounter: number, app = appId) =>
    checkAssertion(Buffer.from(signed.assertion, "base64"), body, signed.publicKey, lastCounter, app);

  assert.equal(check(signed.body, 0), 1);
  assert.throws(() => check(signed.body, 1), /replay/);
  assert.throws(() => check(signed.body.replace("Lorem", "Larem"), 0), /signature/);
  assert.throws(() => check(signed.body, 0, "376HNWM383.com.shaggspeare.anylink"), /app id/);
  // Another key's public key.
  const other = attest(development).publicKey;
  assert.throws(() => checkAssertion(Buffer.from(signed.assertion, "base64"), signed.body, other, 0, appId), /signature/);
});

test("a challenge is good for five minutes, with this secret, untouched", () => {
  const now = Date.UTC(2026, 10, 3, 12);
  const challenge = makeChallenge("secret", now);
  assert.equal(challengeIsFresh(challenge, "secret", now + 60_000), true);
  assert.equal(challengeIsFresh(challenge, "secret", now + 5 * 60_000 + 1), false);
  assert.equal(challengeIsFresh(challenge, "another secret", now), false);
  assert.equal(challengeIsFresh(challenge.replace(/^\d/, "9"), "secret", now), false);
  assert.equal(challengeIsFresh("", "secret", now), false);
  assert.notEqual(makeChallenge("secret", now), challenge);
});

test("daily caps: per kind, a check spends its links, and a new day starts from zero", () => {
  const fresh = { usageDay: null, crawlCount: 0, checkCount: 0, groupCount: 0 };
  const day = "2026-11-03";

  assert.deepEqual(spend(fresh, "crawl", day), { usageDay: day, crawlCount: 1, checkCount: 0, groupCount: 0 });
  assert.deepEqual(spend(fresh, "check", day, 600), { usageDay: day, crawlCount: 0, checkCount: 600, groupCount: 0 });

  const full = { usageDay: day, crawlCount: DAILY_CAPS.crawl, checkCount: DAILY_CAPS.check - 10, groupCount: 0 };
  assert.equal(spend(full, "crawl", day), null);
  assert.equal(spend(full, "check", day, 11), null);
  assert.equal(spend(full, "check", day, 10)?.checkCount, DAILY_CAPS.check);
  assert.equal(spend(full, "group", day)?.groupCount, 1);
  assert.deepEqual(spend(full, "crawl", "2026-11-04"), { usageDay: "2026-11-04", crawlCount: 1, checkCount: 0, groupCount: 0 });
});
