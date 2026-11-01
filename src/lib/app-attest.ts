import { createHash, createHmac, createVerify, randomBytes, timingSafeEqual, X509Certificate } from "node:crypto";

/** Apple's App Attest checks, for iOS installs without an account (docs/adr/0002). The numbered steps follow Apple's
 * "Validating apps that connect to your server". Pure, so node:test runs them against real attestations with no
 * Apple, network or database. Hand-rolled on node:crypto: the libraries add pkijs, asn1js and a CBOR package for the
 * two parsers below. */

/** `<team id>.<bundle id>`. The team id is DEVELOPMENT_TEAM in ios/Config.xcconfig. */
export const APP_ID = "376HNWM383.com.shaggspeare.anylink";

/** "Apple App Attestation Root CA" from https://www.apple.com/certificateauthority/, valid until 2045.
 * SHA-256 fingerprint 1C:B9:82:3B:A2:8B:A6:AD:2D:33:A0:06:94:1D:E2:AE:4F:51:3E:F1:D4:E8:31:B9:F7:E0:FA:7B:62:42:C9:32. */
export const APPLE_ROOT_CA = `-----BEGIN CERTIFICATE-----
MIICITCCAaegAwIBAgIQC/O+DvHN0uD7jG5yH2IXmDAKBggqhkjOPQQDAzBSMSYw
JAYDVQQDDB1BcHBsZSBBcHAgQXR0ZXN0YXRpb24gUm9vdCBDQTETMBEGA1UECgwK
QXBwbGUgSW5jLjETMBEGA1UECAwKQ2FsaWZvcm5pYTAeFw0yMDAzMTgxODMyNTNa
Fw00NTAzMTUwMDAwMDBaMFIxJjAkBgNVBAMMHUFwcGxlIEFwcCBBdHRlc3RhdGlv
biBSb290IENBMRMwEQYDVQQKDApBcHBsZSBJbmMuMRMwEQYDVQQIDApDYWxpZm9y
bmlhMHYwEAYHKoZIzj0CAQYFK4EEACIDYgAERTHhmLW07ATaFQIEVwTtT4dyctdh
NbJhFs/Ii2FdCgAHGbpphY3+d8qjuDngIN3WVhQUBHAoMeQ/cLiP1sOUtgjqK9au
Yen1mMEvRq9Sk3Jm5X8U62H+xTD3FE9TgS41o0IwQDAPBgNVHRMBAf8EBTADAQH/
MB0GA1UdDgQWBBSskRBTM72+aEH/pwyp5frq5eWKoTAOBgNVHQ8BAf8EBAMCAQYw
CgYIKoZIzj0EAwMDaAAwZQIwQgFGnByvsiVbpTKwSga0kP0e8EeDS4+sQmTvb7vn
53O5+FRXgeLhpJ06ysC5PrOyAjEAp5U4xDgEgllF7En3VcE3iexZZtKeYnpqtijV
oyFraWVIyd/dganmrduC1bmTBGwD
-----END CERTIFICATE-----`;

export type AttestedKey = { publicKey: string; environment: "development" | "production" };

const DEVELOPMENT = Buffer.from("appattestdevelop");
const PRODUCTION = Buffer.concat([Buffer.from("appattest"), Buffer.alloc(7)]);
/** 1.2.840.113635.100.8.2, the leaf certificate extension holding the nonce. */
const NONCE_OID = Buffer.from("2a864886f763640802", "hex");

function sha256(...parts: (Buffer | string)[]): Buffer {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest();
}

/** Throws unless `attestation` proves that `keyId` was made in the Secure Enclave of a genuine Apple device running
 * `appId`, in answer to `challenge`. Returns what checking the key's assertions needs later. */
export function checkAttestation(
  attestation: Buffer,
  challenge: string,
  keyId: string,
  appId = APP_ID,
  root = APPLE_ROOT_CA
): AttestedKey {
  const { fmt, attStmt, authData } = decodeCbor(attestation) as Record<string, unknown>;
  const x5c = (attStmt as { x5c?: unknown } | undefined)?.x5c;
  if (fmt !== "apple-appattest" || !Buffer.isBuffer(authData) || !Array.isArray(x5c) || x5c.length < 2) {
    throw new Error("not an App Attest attestation");
  }

  // 1. The credential certificate and the intermediate after it chain up to Apple's App Attest root. No date check:
  //    the nonce below ties the leaf to a challenge minted minutes ago.
  const [leaf, intermediate] = x5c.map((der: Buffer) => new X509Certificate(der));
  if (!intermediate.verify(new X509Certificate(root).publicKey) || !leaf.verify(intermediate.publicKey)) {
    throw new Error("certificate chain");
  }

  // 2–4. The leaf's nonce extension is SHA-256(authData ‖ SHA-256(challenge)).
  if (!nonceExtension(leaf.raw)?.equals(sha256(authData, sha256(challenge)))) throw new Error("nonce");

  // 5. The key id is the SHA-256 of the leaf's public key: the uncompressed P-256 point that ends its SPKI.
  const point = leaf.publicKey.export({ type: "spki", format: "der" }).subarray(-65);
  if (sha256(point).toString("base64") !== keyId) throw new Error("key id");

  // 6. The RP ID hash is the SHA-256 of the app id.
  if (!authData.subarray(0, 32).equals(sha256(appId))) throw new Error("app id");

  // 7. The counter starts at 0.
  if (authData.readUInt32BE(33) !== 0) throw new Error("counter");

  // 8. The aaguid names the environment. Both are accepted, and stored with the key.
  const aaguid = authData.subarray(37, 53);
  const environment = aaguid.equals(PRODUCTION) ? "production" : aaguid.equals(DEVELOPMENT) ? "development" : null;
  if (!environment) throw new Error("aaguid");

  // 9. The credential id is the key id.
  const credentialId = authData.subarray(55, 55 + authData.readUInt16BE(53));
  if (credentialId.toString("base64") !== keyId) throw new Error("credential id");

  return { publicKey: leaf.publicKey.export({ type: "spki", format: "pem" }).toString(), environment };
}

/** Throws unless `assertion` is the key behind `publicKey` signing `body` for `appId`, with a counter past
 * `lastCounter`; returns the new counter. The error "replay" means only the counter failed: a replayed call, or two
 * calls that arrived out of order. Apple's step 6 (a challenge inside the client data) is left out on purpose: each
 * call signs its own body, and the counter has to go up. */
export function checkAssertion(
  assertion: Buffer,
  body: string,
  publicKey: string,
  lastCounter: number,
  appId = APP_ID
): number {
  const { signature, authenticatorData } = decodeCbor(assertion) as Record<string, unknown>;
  if (!Buffer.isBuffer(signature) || !Buffer.isBuffer(authenticatorData)) throw new Error("not an assertion");

  // 1–3. The signature covers nonce = SHA-256(authenticatorData ‖ SHA-256(body)).
  const nonce = sha256(authenticatorData, sha256(body));
  if (!createVerify("sha256").update(nonce).verify(publicKey, signature)) throw new Error("signature");

  // 4. The RP ID hash is the SHA-256 of the app id.
  if (!authenticatorData.subarray(0, 32).equals(sha256(appId))) throw new Error("app id");

  // 5. The counter only goes up.
  const counter = authenticatorData.readUInt32BE(33);
  if (counter <= lastCounter) throw new Error("replay");
  return counter;
}

// MARK: - Challenges

const CHALLENGE_TTL_MS = 5 * 60_000;
const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** A registration challenge that needs no table: a timestamp and random bytes, signed with the server secret. */
export function makeChallenge(secret: string, now = Date.now()): string {
  const payload = `${now}.${randomBytes(16).toString("base64url")}`;
  return `${payload}.${sign(secret, payload)}`;
}

/** Whether `challenge` came from `makeChallenge` with this secret within the last five minutes. */
export function challengeIsFresh(challenge: string, secret: string, now = Date.now()): boolean {
  const cut = challenge.lastIndexOf(".");
  const payload = challenge.slice(0, cut);
  const given = Buffer.from(challenge.slice(cut + 1));
  const expected = Buffer.from(sign(secret, payload));
  const age = now - Number(payload.split(".")[0]);
  return cut > 0 && given.length === expected.length && timingSafeEqual(given, expected) && Math.abs(age) <= CHALLENGE_TTL_MS;
}

// MARK: - Daily caps

export type UsageKind = "crawl" | "check" | "group";
export type Usage = { usageDay: string | null; crawlCount: number; checkCount: number; groupCount: number };

/** Per key and UTC day. A check counts the links in it; a crawl or a grouping counts one call. */
export const DAILY_CAPS: Record<UsageKind, number> = { crawl: 200, check: 5000, group: 10 };

/** Groupings per UTC day across every key together. One device can register many keys, so the per-key caps alone
 * don't bound the day's AI spend; this does. */
export const DAILY_GROUPS_ALL_KEYS = 300;

/** The key's usage after spending `amount` of `kind` on `today` (YYYY-MM-DD), or null when that would pass the day's
 * cap. A new day starts from zero. */
export function spend(usage: Usage, kind: UsageKind, today: string, amount = 1): Usage | null {
  const sameDay = usage.usageDay === today;
  const next: Usage = {
    usageDay: today,
    crawlCount: sameDay ? usage.crawlCount : 0,
    checkCount: sameDay ? usage.checkCount : 0,
    groupCount: sameDay ? usage.groupCount : 0,
  };
  const field = `${kind}Count` as const;
  next[field] += amount;
  return next[field] > DAILY_CAPS[kind] ? null : next;
}

// MARK: - Parsers

/** Just enough CBOR (RFC 8949) for App Attest's two objects: maps, arrays, byte and text strings, and small ints. */
function decodeCbor(buf: Buffer): unknown {
  let at = 0;
  const take = (n: number) => {
    if (n > buf.length - at) throw new Error("cbor: truncated");
    return buf.subarray(at, (at += n));
  };
  const item = (): unknown => {
    const head = take(1)[0];
    const major = head >> 5;
    const info = head & 31;
    const n =
      info < 24 ? info
      : info === 24 ? take(1)[0]
      : info === 25 ? take(2).readUInt16BE()
      : info === 26 ? take(4).readUInt32BE()
      : -1;
    if (n < 0) throw new Error("cbor: unsupported length");
    if (major === 0) return n;
    if (major === 2) return take(n);
    if (major === 3) return take(n).toString("utf8");
    // Every element takes at least a byte, so a huge count can't make us allocate.
    if (n > buf.length - at) throw new Error("cbor: truncated");
    if (major === 4) return Array.from({ length: n }, item);
    if (major === 5) return Object.fromEntries(Array.from({ length: n }, () => [item(), item()]));
    throw new Error("cbor: unsupported type");
  };
  return item();
}

/** One DER element at `at`: its tag, its contents and the offset just past it. */
function tlv(buf: Buffer, at = 0) {
  if (at + 2 > buf.length) throw new Error("der: truncated");
  let length = buf[at + 1];
  let start = at + 2;
  if (length & 0x80) {
    const bytes = length & 0x7f;
    length = buf.readUIntBE(start, bytes);
    start += bytes;
  }
  if (start + length > buf.length) throw new Error("der: truncated");
  return { tag: buf[at], body: buf.subarray(start, start + length), end: start + length };
}

function children(buf: Buffer) {
  const out: ReturnType<typeof tlv>[] = [];
  for (let at = 0; at < buf.length; at = out[out.length - 1].end) out.push(tlv(buf, at));
  return out;
}

/** The nonce in the leaf: Certificate → tbsCertificate → [3] extensions → the Extension with NONCE_OID, whose value
 * is SEQUENCE { [1] { OCTET STRING nonce } }. */
function nonceExtension(certificate: Buffer): Buffer | undefined {
  const tbs = children(tlv(certificate).body)[0];
  const extensions = children(tbs.body).find((element) => element.tag === 0xa3);
  if (!extensions) return undefined;
  for (const extension of children(tlv(extensions.body).body)) {
    const [oid, ...rest] = children(extension.body);
    if (oid?.tag === 0x06 && oid.body.equals(NONCE_OID)) {
      // The value is the last field; a critical flag may sit before it.
      return tlv(tlv(tlv(rest[rest.length - 1].body).body).body).body;
    }
  }
  return undefined;
}
