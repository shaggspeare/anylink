import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { users } from "./schema";
import { supabaseServer } from "../supabase/server";
import { supabaseAdmin } from "../storage/client";
import { isPro, type Plan } from "../plan";

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

/** The caller's plan, read once per request with its expiry applied; gate on it with `isPro` (../plan). Signed-out
 * callers are free. */
export const currentPlan = cache(async (): Promise<Plan> => {
  const user = await currentUser();
  if (!user) return "free";
  const [row] = await db
    .select({ plan: users.plan, planExpiresAt: users.planExpiresAt })
    .from(users)
    .where(eq(users.id, user.id));
  return isPro(row) ? "pro" : "free";
});

/** For everything that reads or writes a library: no session, no access. */
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}
