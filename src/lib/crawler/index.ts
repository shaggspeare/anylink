import { fetchHtml } from "./fetch-page";
import { parseHtml } from "./parse-page";
import { CrawlError } from "./errors";
import { identityForDomain } from "../card-identity";
import type { CrawlResult, CrawlStep } from "./types";

export { CrawlError } from "./errors";
export type { CrawlResult, CrawlStep } from "./types";
export { CRAWL_STEPS } from "./types";

export type CrawlFailure = {
  failed: true;
  domain: string;
  tint: string;
  stripe: string;
  initial: string;
  reason: string;
};

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Runs the full crawl pipeline, invoking onStep as each phase completes. */
export async function crawlUrl(
  url: string,
  onStep: (step: CrawlStep) => void
): Promise<CrawlResult | CrawlFailure> {
  const domain = domainFromUrl(url);

  let html: string;
  let finalUrl: string;
  try {
    ({ html, finalUrl } = await fetchHtml(url));
    onStep("fetch");
  } catch (err) {
    const identity = identityForDomain(domain);
    return {
      failed: true,
      domain,
      ...identity,
      reason: err instanceof CrawlError ? err.reason : "network",
    };
  }

  const result = parseHtml(html, finalUrl);
  onStep("parse");

  // No image pipeline yet (PLAN.md §3 step 4) — the crawled hero URL is hotlinked
  // for now instead of downloaded/resized/re-hosted.
  onStep("images");

  onStep("tags");
  return result;
}
