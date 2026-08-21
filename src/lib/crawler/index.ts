import { fetchHtml } from "./fetch-page";
import { fetchHtmlWithBrowser } from "./fetch-page-browser";
import { fetchMetadataFallback } from "./fetch-metadata-fallback";
import { parseHtml } from "./parse-page";
import { CrawlError } from "./errors";
import { identityForDomain } from "../card-identity";
import { structureContent } from "../structure/structure-content";
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

  let result: CrawlResult;
  try {
    const { html, finalUrl } = await fetchHtmlAnyWay(url);
    onStep("fetch");
    result = parseHtml(html, finalUrl);
  } catch (err) {
    // Both plain fetch and a real headless browser got blocked — last resort is a
    // third party (microlink) whose IP reputation isn't tied to ours. Metadata
    // and an image only, no article body, which is the accepted floor for sites
    // blocked this hard (see PLAN.md risks).
    onStep("fetch");
    const metadataResult = await fetchMetadataFallback(url);
    if (!metadataResult) {
      return {
        failed: true,
        domain,
        ...identityForDomain(domain),
        reason: err instanceof CrawlError ? err.reason : "network",
      };
    }
    result = metadataResult;
  }
  onStep("parse");

  // Hero image download/resize/re-host happens later, at save time (createLink) —
  // not here, so an abandoned crawl never uploads anything.
  onStep("images");

  await enrichWithLLM(result);
  onStep("tags");
  return result;
}

/** Plain fetch, falling back to a real headless browser if that gets blocked —
 * anything else (DNS failure, timeout, non-HTML) a browser won't fix either, so
 * it throws straight through. */
async function fetchHtmlAnyWay(url: string): Promise<{ html: string; finalUrl: string }> {
  try {
    return await fetchHtml(url);
  } catch (err) {
    if (err instanceof CrawlError && err.reason === "blocked") {
      return await fetchHtmlWithBrowser(url);
    }
    throw err;
  }
}

/** Runs on every crawl: cleans up the extracted article text and, when the
 * regex/JSON-LD parsing came up weak, has the model take a pass at metadata
 * (title/type/tags/product fields) instead. Best-effort — never fails the crawl. */
async function enrichWithLLM(result: CrawlResult): Promise<void> {
  const rawText = result.articleText.join("\n\n") || result.excerpt;
  if (!rawText) return;

  const structured = await structureContent({
    url: result.canonicalUrl,
    domain: result.domain,
    title: result.title,
    excerpt: result.excerpt,
    rawText,
    contentTypeGuess: result.contentType,
    existingProduct: result.product
      ? { price: result.product.price, currency: result.product.currency, inStock: result.product.inStock }
      : undefined,
  });
  if (!structured) return;

  result.title = structured.title;
  result.excerpt = structured.excerpt;
  if (structured.articleText.length > 0) result.articleText = structured.articleText;
  if (structured.tags.length > 0) result.suggestedTags = structured.tags;

  result.contentType = structured.contentType;
  if (structured.contentType === "product") {
    const identity = identityForDomain(result.domain);
    result.product ??= {
      retailer: result.domain,
      retailerInitial: identity.initial,
      retailerColor: identity.tint,
      currency: "$",
      variants: [],
      specs: [],
      totalSpecCount: 0,
      priceHistory: [],
    };
    if (structured.product?.price !== undefined) result.product.price = structured.product.price;
    if (structured.product?.currency) result.product.currency = structured.product.currency;
    if (structured.product?.inStock !== undefined) result.product.inStock = structured.product.inStock;
    if (result.product.priceHistory.length === 0 && result.product.price !== undefined) {
      result.product.priceHistory = [
        { date: new Date().toISOString().slice(0, 10), price: result.product.price },
      ];
    }
  }
}
