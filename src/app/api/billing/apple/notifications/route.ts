import { handleNotification } from "@/lib/billing/apple";
import { applyPlanEvent } from "@/lib/db/plan";

/** App Store Server Notifications V2, from Apple: the URL App Store Connect has for production and sandbox. Renewals,
 * expiry, grace periods, refunds and revokes update the account the transaction's `appAccountToken` names. Apple
 * resends anything but a 200, so every notification that verifies gets one. Outside `api/v1`, and src/proxy.ts skips
 * it, so nothing redirects Apple's POST. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const status = await handleNotification(typeof body?.signedPayload === "string" ? body.signedPayload : "", applyPlanEvent);
  return status === 200 ? new Response(null, { status }) : Response.json({ ok: false, reason: status === 503 ? "retry" : "invalid" }, { status });
}
