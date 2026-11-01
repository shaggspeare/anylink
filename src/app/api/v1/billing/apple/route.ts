import { purchaseEvent } from "@/lib/billing/apple";
import { currentUser } from "@/lib/db/current-user";
import { applyPlanEvent } from "@/lib/db/plan";

/** `{ jws }`: a StoreKit transaction from the iOS app, after a purchase, for a renewal it saw, or on Restore. Answers
 * `{ ok: true }` once it's on the account; only this signed-in call can move an account onto a purchase. A refusal is
 * never a 401, which signs iOS out: 403 `{ ok: false, reason }` with `signed-out`, `environment` (not accepted here),
 * `invalid` (didn't verify), `account` (bought by another account) or `product` (not Pro), or 503 `retry` when Apple's
 * revocation check couldn't be reached. */
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return refuse("signed-out");
  const body = await request.json().catch(() => null);
  const result = await purchaseEvent(typeof body?.jws === "string" ? body.jws : "", user.id);
  if (typeof result === "string") return refuse(result);
  await applyPlanEvent(user.id, result);
  return Response.json({ ok: true });
}

function refuse(reason: string) {
  return Response.json({ ok: false, reason }, { status: reason === "retry" ? 503 : 403 });
}
