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
export type PlanEvent = {
  /** "app": the signed-in app posted it, so it may move the account onto this purchase. "apple": a notification,
   * routed by an `appAccountToken` any client can choose, so it only touches the purchase the account is on. */
  from: "app" | "apple";
  /** StoreKit's `originalTransactionId`: one per purchase, kept across renewals and upgrades within the group. */
  purchase: string;
  /** What a refund is recorded under: the purchase for lifetime (every copy of it), the transaction for a subscription
   * (resubscribing later is the same purchase, but new money). */
  refundKey: string;
  /** The App Store product, prefixed "sandbox:" (or "xcode:") outside production. */
  product: string;
  /** When Apple signed it, in ms: a refund and its reversal can arrive in either order, and the later one wins. */
  signedAt: number;
} & (
  /** Pro until `until` (null: lifetime), bought at `purchasedAt`. `reversal`: Apple took back the refund of it. */
  | { kind: "grant"; until: Date | null; purchasedAt: Date; reversal?: boolean }
  /** Pro from it ended at `at`; `refund` when refunded or revoked. It covered Pro until `covered` (null: lifetime). */
  | { kind: "end"; covered: Date | null; at: Date; refund?: boolean }
);

/** The plan columns a purchase writes. */
export type StoredPlan = {
  plan: string;
  planProduct: string | null;
  planExpiresAt: Date | null;
  /** The purchase Pro came from. Null for grandfathered accounts, which no App Store event can touch. */
  planTransaction: string | null;
  /** Apple's last word on each refunded purchase: "<refundKey>:refunded:<ms>" or "<refundKey>:reversed:<ms>". */
  planRevoked: string[];
};

const REFUND_NEWS = /^(.*):(refunded|reversed):(\d+)$/;

/** Apple's last word on `key` in a refund log. */
function refundNews(log: string[], key: string) {
  for (const entry of log) {
    const m = REFUND_NEWS.exec(entry);
    if (m?.[1] === key) return { refunded: m[2] === "refunded", at: Number(m[3]) };
  }
}

/** The plan after `event`, or null to leave it alone. Apple resends and reorders notifications, and the app reposts
 * old transactions, so a stale event must never undo a newer one, and a refunded purchase must never grant again. */
export function planAfter(row: StoredPlan, event: PlanEvent): StoredPlan | null {
  // Refunds and reversals go on the log first, whatever they do to Pro: a purchase refunded before it was ever posted
  // can't grant later either.
  let log = row.planRevoked;
  const refund = event.kind === "end" && event.refund;
  if (refund || (event.kind === "grant" && event.reversal)) {
    const last = refundNews(log, event.refundKey);
    if (last && last.at > event.signedAt) return null;
    log = [
      ...log.filter((entry) => REFUND_NEWS.exec(entry)?.[1] !== event.refundKey),
      `${event.refundKey}:${refund ? "refunded" : "reversed"}:${event.signedAt}`,
    ];
  }
  const unchanged = log === row.planRevoked ? null : { ...row, planRevoked: log };
  const pro = row.plan === "pro";
  const current = row.planTransaction === event.purchase;
  if (event.from === "apple" && !current) return unchanged;

  if (event.kind === "grant") {
    if (refundNews(log, event.refundKey)?.refunded) return unchanged;
    // Lifetime and grandfathered accounts already have everything.
    if (pro && !row.planExpiresAt) return unchanged;
    // Never shortens Pro: an older renewal arriving after a newer one.
    if (pro && event.until && row.planExpiresAt && row.planExpiresAt >= event.until) return unchanged;
    // Bought before Pro from this purchase ended: an old transaction of it, sent again.
    if (!pro && current && !event.reversal && row.planExpiresAt && event.purchasedAt <= row.planExpiresAt) return unchanged;
    return { ...row, planRevoked: log, plan: "pro", planProduct: event.product, planExpiresAt: event.until, planTransaction: event.purchase };
  }
  // Pro comes from another purchase, or the account is grandfathered.
  if (!current) return unchanged;
  // A newer transaction of this purchase already took Pro past what this one covered.
  if (event.covered && row.planExpiresAt && row.planExpiresAt > event.covered) return unchanged;
  return { ...row, planRevoked: log, plan: "free", planExpiresAt: event.at };
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
