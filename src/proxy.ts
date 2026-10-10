import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Refreshes the Supabase session cookie before any page renders — server components
 * can read cookies but not write them, so an expired token would otherwise stick. */
export async function proxy(request: NextRequest) {
  // Supabase falls back to the Site URL when a redirect isn't on its allow list, so a sign-in
  // code can land on any page. Hand it to the callback instead of dropping it.
  const { pathname, searchParams } = request.nextUrl;
  if (searchParams.has("code") && pathname !== "/auth/callback" && !pathname.startsWith("/api/")) {
    const callback = request.nextUrl.clone();
    callback.pathname = "/auth/callback";
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  // Not the iOS API (bearer tokens, no cookies) or static files.
  matcher: ["/((?!_next/static|_next/image|images/|api/v1/|favicon.ico|.*\\.(?:webp|png|jpg|svg|ico)$).*)"],
};
