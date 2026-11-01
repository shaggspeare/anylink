import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { planAfter, type PlanEvent } from "../plan";

/** `isPro` (../plan.ts) in SQL over `users`, for queries that pick accounts in bulk: the crons and share links. */
export const proAccounts = and(eq(users.plan, "pro"), or(isNull(users.planExpiresAt), gt(users.planExpiresAt, sql`now()`)));

/** Records a verified App Store event on the account (`planAfter`). The row is locked, so the app's post and Apple's
 * notification about the same purchase can't interleave. An unknown account changes nothing. */
export async function applyPlanEvent(userId: string, event: PlanEvent): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ plan: users.plan, planProduct: users.planProduct, planExpiresAt: users.planExpiresAt })
      .from(users)
      .where(eq(users.id, userId))
      .for("update");
    const next = row && planAfter(row, event);
    if (next) await tx.update(users).set(next).where(eq(users.id, userId));
  });
}
