/** An account's plan (docs/adr/0002). `users.plan` on the server is the only source of truth; both apps read it
 * from the library (`getLibraryData`). */
export type Plan = "free" | "pro";

/** The plan as `users` stores it. `planExpiresAt` is when Pro ends; none means lifetime. */
export type PlanRow = { plan: string | null; planExpiresAt?: Date | null };

/** The one rule for who gets Pro: plan "pro", and either no expiry (lifetime, grandfathered) or one still ahead.
 * Anything else is free: no account, no row, an unknown value, a lapsed subscription. A bare plan string, like the
 * "pro" the library sends the apps, already had the expiry applied. SQL twin: `proAccounts` in db/plan.ts. */
export function isPro(plan: PlanRow | string | null | undefined, now = new Date()): boolean {
  if (typeof plan === "string" || !plan) return plan === "pro";
  return plan.plan === "pro" && (!plan.planExpiresAt || plan.planExpiresAt > now);
}

/** What a gated action returns to a free account, the way `setPinned` reports the pin limit. Never thrown:
 * production builds hide a Server Action's error text, and iOS signs out on a 401. */
export const PRO_REQUIRED = { ok: false, reason: "pro" } as const;
