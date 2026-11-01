import { makeChallenge } from "@/lib/app-attest";

// A fresh challenge every time, never a cached one.
export const dynamic = "force-dynamic";

/** Step one of registering an iOS install's App Attest key: `{ challenge }`, signed with APP_ATTEST_SECRET and good
 * for five minutes, so no table is needed. The app attests its key over the SHA-256 of it, then calls
 * /api/attest/register. */
export function GET() {
  const secret = process.env.APP_ATTEST_SECRET;
  if (!secret) return Response.json({ error: "App Attest isn't set up on this server." }, { status: 503 });
  return Response.json({ challenge: makeChallenge(secret) }, { headers: { "Cache-Control": "no-store" } });
}
