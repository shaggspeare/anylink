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

/** Lifetime Pro's fair use: once it has saved this many links in a calendar month, its crawls are free crawls until
 * the month turns. */
export const LIFETIME_FAIR_USE = 1000;

/** Whether a crawl may use the model and the headless browser: Pro, except a lifetime account (no expiry, so a
 * lifetime purchase or a grandfathered account) that has saved `LIFETIME_FAIR_USE` links this month. */
export function fullCrawl(row: PlanRow | null | undefined, linksThisMonth: number, now = new Date()): boolean {
  return isPro(row, now) && (Boolean(row?.planExpiresAt) || linksThisMonth < LIFETIME_FAIR_USE);
}

/** What a verified purchase or App Store notification means for an account (src/lib/billing/apple.ts). */
export type PlanEvent =
  /** Pro from `product` until `until` (null: lifetime), bought at `purchasedAt`. */
  | { kind: "grant"; product: string; until: Date | null; purchasedAt: Date }
  /** Pro from `product` ended at `at`. The transaction behind it covered Pro until `covered` (null: lifetime). */
  | { kind: "end"; product: string; covered: Date | null; at: Date };

/** The plan columns a purchase writes. */
export type StoredPlan = { plan: string; planProduct: string | null; planExpiresAt: Date | null };

/** The plan after `event`, or null to leave it alone. Apple resends and reorders notifications, and the app reposts
 * old transactions, so a stale event must never undo a newer one. */
export function planAfter(row: StoredPlan, event: PlanEvent): StoredPlan | null {
  const pro = row.plan === "pro";
  const { product } = event;
  if (event.kind === "grant") {
    // Lifetime and grandfathered accounts already have everything; a subscription on top changes nothing.
    if (pro && !row.planExpiresAt) return null;
    // Never shortens Pro: an older renewal arriving after a newer one.
    if (pro && event.until && row.planExpiresAt && row.planExpiresAt >= event.until) return null;
    // Bought before Pro from this product ended: a transaction from before a refund, sent again.
    if (!pro && row.planProduct === product && row.planExpiresAt && event.purchasedAt <= row.planExpiresAt) return null;
    return { plan: "pro", planProduct: product, planExpiresAt: event.until };
  }
  // Pro comes from something else: another product, or a grandfathered account.
  if (row.planProduct !== product) return null;
  // A newer transaction for this product already took Pro past what this one covered.
  if (event.covered && row.planExpiresAt && row.planExpiresAt > event.covered) return null;
  return { plan: "free", planProduct: product, planExpiresAt: event.at };
}

/** What a gated action returns to a free account, the way `setPinned` reports the pin limit. Never thrown:
 * production builds hide a Server Action's error text, and iOS signs out on a 401. */
export const PRO_REQUIRED = { ok: false, reason: "pro" } as const;

/** Whether an action answered `PRO_REQUIRED`. */
export function isProRefusal(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { reason?: unknown }).reason === "pro";
}

/** `api` with every function wrapped: one answering `PRO_REQUIRED` also calls `onRefusal`. The web store wraps its
 * actions in it, so each Pro refusal opens the Pro dialog, including from actions added later. */
export function proAware<T extends object>(api: T, onRefusal: () => void): T {
  return new Proxy(api, {
    get: (target, key) => {
      const value: unknown = Reflect.get(target, key);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        const result = await (value as (...a: unknown[]) => unknown)(...args);
        if (isProRefusal(result)) onRefusal();
        return result;
      };
    },
  });
}
