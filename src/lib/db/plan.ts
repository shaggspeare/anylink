import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { users } from "./schema";

/** `isPro` (../plan.ts) in SQL over `users`, for queries that pick accounts in bulk: the crons and share links. */
export const proAccounts = and(eq(users.plan, "pro"), or(isNull(users.planExpiresAt), gt(users.planExpiresAt, sql`now()`)));
