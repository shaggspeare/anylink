/** What "dead" means, in one place. Pure and dependency-free so both the checker
 * (server) and the search/filter layer (browser) read from the same rule. */

/** The host never answered — DNS failure, timeout, connection reset. */
export const NO_ANSWER = 0;
/** Answered 200, but with a domain-parking page rather than the thing that was saved.
 * No real HTTP status is below 100, so neither sentinel can collide with one. */
export const PARKED = 1;

/** The page is gone, and said so. Everything else in 4xx/5xx is the site refusing a
 * bot or having a bad minute — seriouseats.com answers a crawler with 402, Cloudflare
 * sites with 403 or 503 — and those links are fine in a browser. A false "dead" costs
 * the user a link they wanted; a missed one costs them a click. */
const GONE = new Set([404, 410]);

export function isDeadStatus(status: number): boolean {
  return status === NO_ANSWER || status === PARKED || GONE.has(status);
}

/** undefined = never checked. */
export function isBrokenStatus(status: number | undefined): boolean {
  return status !== undefined && isDeadStatus(status);
}
