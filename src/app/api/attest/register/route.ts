import { challengeIsFresh, checkAttestation } from "@/lib/app-attest";
import { db } from "@/lib/db/client";
import { appAttestKeys } from "@/lib/db/schema";

/** Step two: `{ keyId, attestation, challenge }` from DCAppAttestService. Stores the key once Apple's attestation
 * checks out for this app and a challenge from /api/attest/challenge. Refusals are 403s, never 401s.
 * ponytail: one device can register many keys, each with its own daily caps; limit registrations per IP, or read
 * Apple's fraud receipt, if that gets abused. */
export async function POST(request: Request) {
  const secret = process.env.APP_ATTEST_SECRET;
  if (!secret) return Response.json({ error: "App Attest isn't set up on this server." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const { keyId, attestation, challenge } = body ?? {};
  if (typeof keyId !== "string" || typeof attestation !== "string" || typeof challenge !== "string") {
    return Response.json({ error: "Body must be { keyId, attestation, challenge }" }, { status: 400 });
  }
  if (!challengeIsFresh(challenge, secret)) {
    return Response.json({ error: "The challenge expired. Ask for a new one.", reason: "challenge" }, { status: 403 });
  }

  let key;
  try {
    key = checkAttestation(Buffer.from(attestation, "base64"), challenge, keyId);
  } catch (error) {
    console.warn("App Attest registration refused:", error instanceof Error ? error.message : error);
    return Response.json({ error: "This device couldn't be verified.", reason: "invalid" }, { status: 403 });
  }

  // A key registers once: replaying its registration can't wind the counter back.
  await db.insert(appAttestKeys).values({ keyId, ...key }).onConflictDoNothing();
  return Response.json({ ok: true });
}
