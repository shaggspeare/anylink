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
              Continue with Apple
            </button>
            <button type="button" disabled={busy} onClick={() => oauth("google")} className={secondary}>
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
