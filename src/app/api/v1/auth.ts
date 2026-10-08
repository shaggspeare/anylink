import { currentUser } from "@/lib/db/current-user";

/** The native app's way in: `Authorization: Bearer <Supabase access token>`. */
export async function unauthorized(): Promise<Response | null> {
  return (await currentUser()) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
