import { cache } from "react";
import { headers } from "next/headers";
import { supabaseServer } from "../supabase/server";
import { supabaseAdmin } from "../storage/client";

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

/** For everything that reads or writes a library: no session, no access. */
export async function currentUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}
