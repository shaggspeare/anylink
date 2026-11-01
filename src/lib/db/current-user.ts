import { cache } from "react";
import { headers } from "next/headers";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import { links, users } from "./schema";
import { supabaseServer } from "../supabase/server";
import { supabaseAdmin } from "../storage/client";
import { fullCrawl, isPro, type Plan } from "../plan";

export type CurrentUser = { id: string; email: string | null };

/** The signed-in user, or null for a guest. iOS sends `Authorization: Bearer <Supabase JWT>`,
 * the web app a session cookie; both are verified by Supabase (JWKS, cached). `public.users`
 * gets its row from a trigger on `auth.users`, so the id is the same everywhere. */
export const currentUser = cache(async (): Promise<CurrentUser | null> => {
  const bearer = (await headers()).get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const supabase = bearer ? supabaseAdmin : await supabaseServer();
  const { data } = await supabase.auth.getClaims(bearer);
  const claims = data?.claims;
  return claims?.sub ? { id: claims.sub, email: (claims.email as string | undefined) ?? null } : null;
});

/** The caller's plan columns, read once per request. Null when signed out. */
const planRow = cache(async () => {
  const user = await currentUser();
  if (!user) return null;
  const [row] = await db
    .select({ plan: users.plan, planExpiresAt: users.planExpiresAt })
    .from(users)
    .where(eq(users.id, user.id));
  return row ? { ...row, userId: user.id } : null;
});

/** The caller's plan with its expiry applied; gate on it with `isPro` (../plan). Signed-out callers are free. */
export const currentPlan = cache(async (): Promise<Plan> => (isPro(await planRow()) ? "pro" : "free"));

/** Whether this request's crawls get the model and the headless browser (`fullCrawl`, ../plan): Pro, except a lifetime
 * account past its fair use this month. Signed-out callers and free accounts get free crawls. */
export const fullCrawls = cache(async (): Promise<boolean> => {
  const row = await planRow();
  // Only lifetime has a cap, so only lifetime pays for the count. Saves count, imports don't: an import doesn't crawl.
  // ponytail: counts links, not AI calls; count AI calls if this gets abused.
  const [counted] =
    row && isPro(row) && !row.planExpiresAt
      ? await db
          .select({ n: sql<number>`count(*)::int` })
          .from(links)
          .where(and(eq(links.userId, row.userId), isNull(links.importMeta), gte(links.createdAt, sql`date_trunc('month', now())`)))
      : [];
  return fullCrawl(row, counted?.n ?? 0);
});

/** For everything that reads or writes a library: no session, no access. */
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}
