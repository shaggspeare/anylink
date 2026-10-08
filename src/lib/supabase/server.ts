import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Per request, never shared. Server components can't write cookies, hence the try:
 * the proxy refreshes the session before they run. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {}
      },
    },
  });
}
