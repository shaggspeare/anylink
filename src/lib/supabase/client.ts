import { createBrowserClient } from "@supabase/ssr";

export const supabaseBrowser = () =>
  createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/** Sign out and reload, so the root layout swaps the library back to the guest demo. */
export async function signOut() {
  await supabaseBrowser().auth.signOut();
  // A full load drops the signed-in library from memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  location.assign("/");
}
