import { timingSafeEqual } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "./client";
import { appAttestKeys } from "./schema";
import { checkAssertion, spend, type UsageKind } from "../app-attest";

/** Calls from an iOS install without an account (docs/adr/0002) carry `X-AnyLink-Key` and `X-AnyLink-Assertion`: an
 * App Attest assertion over the SHA-256 of the body, from a key registered at /api/attest/register. A refusal is a 403
 * with a reason, never a 401, which would sign the iOS user out. */

function refuse(reason: string): Response {
  return Response.json({ error: "This call couldn't be verified.", reason }, { status: 403 });
}

/** The simulator can't attest, so DEBUG builds send `X-AnyLink-Dev`. It counts only where APP_ATTEST_DEV_SECRET is set,
 * which is never production. */
function devBypass(request: Request): boolean {
  const secret = Buffer.from(process.env.APP_ATTEST_DEV_SECRET ?? "");
  const given = Buffer.from(request.headers.get("x-anylink-dev") ?? "");
  return secret.length > 0 && given.length === secret.length && timingSafeEqual(given, secret);
}

/** Whether the call presents an assertion (or the dev secret), so /api/crawl checks it instead of the per-IP limit. */
export function claimsAttestation(request: Request): boolean {
  return request.headers.has("x-anylink-assertion") || devBypass(request);
}

/** Checks the call's assertion over `body`, then spends `amount` from the key's daily `kind` cap. Returns null when the
 * call may go ahead, otherwise the 403 or 429 to answer with. Stores nothing but the key's counter and counts. */
export async function verifyAssertion(
  request: Request,
  body: string,
  kind: UsageKind,
  amount = 1
): Promise<Response | null> {
  if (devBypass(request)) return null;
  const keyId = request.headers.get("x-anylink-key");
  const assertion = request.headers.get("x-anylink-assertion");
  if (!keyId || !assertion) return refuse("attestation-required");

  const [key] = await db.select().from(appAttestKeys).where(eq(appAttestKeys.keyId, keyId));
  if (!key) return refuse("unknown-key");

  let counter: number;
  try {
    counter = checkAssertion(Buffer.from(assertion, "base64"), body, key.publicKey, key.signCount);
  } catch (error) {
    return refuse(error instanceof Error && error.message === "replay" ? "replay" : "invalid");
  }

  // The counter only moves forward, so of two calls racing with one counter, the second reads as a replay.
  // ponytail: counts are written from the row read above, so racing calls can undercount; count in SQL if that's abused.
  const usage = spend(key, kind, new Date().toISOString().slice(0, 10), amount);
  const [moved] = await db
    .update(appAttestKeys)
    .set({ signCount: counter, lastUsedAt: new Date(), ...usage })
    .where(and(eq(appAttestKeys.keyId, keyId), lt(appAttestKeys.signCount, counter)))
    .returning({ keyId: appAttestKeys.keyId });
  if (!moved) return refuse("replay");
  if (!usage) {
    return Response.json(
      { error: "That's today's limit for this device. It resets at midnight UTC.", reason: "daily-cap" },
      { status: 429 }
    );
  }
  return null;
}
