// explicit extension so `node --test src/lib/crawler/url.test.ts` resolves this
// without a bundler or a test framework in the way
import { identityForDomain } from "../card-identity.ts";

/** Pure URL helpers — no jsdom/node deps, so client components can import this. */

export type CrawlFailure = {
  failed: true;
  domain: string;
  tint: string;
  stripe: string;
  initial: string;
  reason: string;
  /** Best guess at a title from the URL itself, so a failed crawl still opens a
   * prefilled form instead of an empty one. */
  suggestedTitle: string;
};

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "msclkid",
  "yclid",
  "ttclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "_openstat",
  "ref_src",
  "si",
]);

export function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Strips tracking params so the same product pasted from an ad, a newsletter and
 * a share sheet all store as one URL. Everything else is left alone — plenty of
 * sites route on query params. */
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    for (const key of [...u.searchParams.keys()]) {
      if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return raw;
  }
}

/** "…/ua/apple-macbook-air-m4/p123456/" -> "Apple macbook air m4". Falls back to
 * the domain when the path carries nothing readable. */
export function titleFromUrl(raw: string): string {
  const domain = domainFromUrl(raw);
  try {
    const segments = new URL(raw).pathname
      .split("/")
      .filter(Boolean)
      .map((s) => decodeURIComponent(s).replace(/\.(html?|php|aspx?)$/i, ""))
      // ids, slugs-with-no-letters and "p123456"-style segments read as noise
      .filter((s) => /[a-z]{3}/i.test(s) && !/^[a-z]\d+$/i.test(s));

    const slug = segments.at(-1);
    if (!slug) return domain;

    const words = slug.replace(/[-_+]+/g, " ").replace(/\s+/g, " ").trim();
    if (words.length < 3) return domain;
    return words.charAt(0).toUpperCase() + words.slice(1);
  } catch {
    return domain;
  }
}

export function failureFor(url: string, reason: string): CrawlFailure {
  const domain = domainFromUrl(url);
  return {
    failed: true,
    domain,
    ...identityForDomain(domain),
    reason,
    suggestedTitle: titleFromUrl(url),
  };
}
