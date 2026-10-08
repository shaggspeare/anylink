import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Where Google, Apple and the email magic link come back to: trade the code for a session cookie. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  // Only same-site paths — `next` comes from the query string.
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(target, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=1", url.origin));
}
