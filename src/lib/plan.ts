/** An account's plan (docs/adr/0002). `users.plan` on the server is the only source of truth; both apps read it
 * from the library (`getLibraryData`). */
export type Plan = "free" | "pro";

/** The one rule for who gets Pro. Anything but "pro" (no account, no row, an unknown value) is free. */
export function isPro(plan: string | null | undefined): boolean {
  return plan === "pro";
}
