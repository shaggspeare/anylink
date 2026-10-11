"use client";

import { useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

/** Google, Apple, or an emailed code. The email also carries a magic link (Supabase sends
 * one message with both), so it works from the phone that opened it too. */
export function AuthPanel({ title = "Sign in to AnyLink", subtitle }: { title?: string; subtitle?: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = supabaseBrowser();
  const callback = () => `${location.origin}/auth/callback?next=${encodeURIComponent(location.pathname === "/login" ? "/app" : location.pathname)}`;

  const oauth = async (provider: "google" | "apple") => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback() } });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    // A full load: the root layout swaps the guest library for theirs.
    location.assign(location.pathname === "/login" ? "/app" : location.pathname);
  };

  const field = "h-12 w-full rounded-full border border-rim/90 bg-surface/70 px-5 text-body text-ink outline-none";
  const primary = "flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 text-body font-semibold text-on-ink disabled:opacity-50";
  const secondary = "flex h-12 w-full items-center justify-center gap-2 rounded-full border border-rim/90 bg-surface/70 px-6 text-body font-semibold text-ink disabled:opacity-50";

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <Logo className="h-10 w-10" />
      <h1 className="text-hero text-[26px]">{title}</h1>
      {subtitle && <p className="text-body text-ink/65">{subtitle}</p>}

      {sent ? (
        <form onSubmit={verify} className="mt-2 flex flex-col gap-3">
          <p className="text-body text-ink/65">
            We sent a code to <span className="font-semibold text-ink">{email}</span>. Enter it here or tap the link in the email.
          </p>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Code from the email"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${field} text-center tracking-[0.3em]`}
          />
          <button type="submit" disabled={busy || code.trim().length < 6} className={primary}>
            Sign in
          </button>
          <button type="button" onClick={() => setSent(false)} className="text-meta text-ink/60 hover:underline">
            Use a different email
          </button>
        </form>
      ) : (
        <>
          <div className="mt-2 flex flex-col gap-2.5">
            <button type="button" disabled={busy} onClick={() => oauth("apple")} className={primary}>
              <svg aria-hidden="true" viewBox="0 0 384 512" className="h-[18px] w-[18px] fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-24.1 71.5 26.1 2 49.9-11.4 68-33.9z" /></svg>
              Continue with Apple
            </button>
            <button type="button" disabled={busy} onClick={() => oauth("google")} className={secondary}>
              <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px]"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
              Continue with Google
            </button>
          </div>
          <div className="my-1 flex items-center gap-3 text-meta text-ink/45">
            <span className="h-px flex-1 bg-ink/10" />
            or
            <span className="h-px flex-1 bg-ink/10" />
          </div>
          <form onSubmit={sendCode} className="flex flex-col gap-2.5">
            <input
              type="email"
              required
              autoComplete="email"
              aria-label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={field}
            />
            <button type="submit" disabled={busy || !email.includes("@")} className={secondary}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-none stroke-current stroke-2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
              Email me a sign-in code
            </button>
          </form>
        </>
      )}
      {error && (
        <p role="alert" className="text-meta text-[var(--signal-orange)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** The guest limit's prompt: same panel, over whatever they were doing. */
export function AuthDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create an account"
      className="fixed inset-0 z-[70] grid items-end sm:place-items-center sm:p-4"
      style={{ background: "rgba(13,14,16,.42)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        className="glass-70 relative flex justify-center rounded-t-[28px] p-7 pb-[max(28px,env(safe-area-inset-bottom))] sm:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-5 top-5 text-ink/50 hover:text-ink">
          ✕
        </button>
        <AuthPanel
          title="Keep everything you save"
          subtitle="Create a free account to save more. What you've added so far comes with you."
        />
      </div>
    </div>
  );
}
