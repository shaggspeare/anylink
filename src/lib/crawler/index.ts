import { fetchHtml } from "./fetch-page";
import { fetchHtmlWithBrowser } from "./fetch-page-browser";
import { fetchMetadataFallback } from "./fetch-metadata-fallback";
import { parseHtml } from "./parse-page";
import { CrawlError } from "./errors";
import { identityForDomain } from "../card-identity";
import { failureFor, isChallengeTitle, looksBlocked, metadataFloor, type CrawlFailure } from "./url";
import { structureContent } from "../structure/structure-content";
import type { CrawlResult, CrawlStep } from "./types";

export { CrawlError } from "./errors";
export type { CrawlResult, CrawlStep } from "./types";
export { CRAWL_STEPS } from "./types";
export type { CrawlFailure } from "./url";

/** Reasons that mean "the site wouldn't serve us" rather than "there's nothing
 * there" — those degrade to metadata instead of failing. */
const REFUSED = new Set(["blocked", "not-html", "not-found"]);

/** Runs the full crawl pipeline, invoking onStep as each phase completes. */
export async function crawlUrl(
  url: string,
  onStep: (step: CrawlStep) => void
): Promise<CrawlResult | CrawlFailure> {
  let result: CrawlResult | null = null;
  let reason = "network";
  let blockedHtml: string | undefined;

  try {
    result = await fetchAndParse(url);
  } catch (err) {
    if (err instanceof CrawlError) {
      reason = err.reason;
      blockedHtml = err.html;
    }
  }
  onStep("fetch");

  // The page refused us. Rather than failing, degrade to metadata: first a third
  // party (microlink) whose IP reputation isn't tied to ours, then whatever the
  // block page itself carried, then the URL alone. No article body — but the LLM
  // pass below turns any of these into a card worth looking at, which beats an
  // empty form for sites blocked this hard (see PLAN.md risks).
  if (!result && REFUSED.has(reason)) {
    // Every source gets the same gate: an error shell relayed by microlink is no
    // more a page than one we fetched ourselves.
    const viaMicrolink = await fetchMetadataFallback(url);
    result = viaMicrolink && !looksBlocked(viaMicrolink) ? viaMicrolink : null;
    if (!result && blockedHtml) result = salvage(blockedHtml, url);
    // A 404 nobody else can see past either is a real 404, not a bot wall — that
    // one doesn't get a made-up card.
    if (!result && reason !== "not-found") result = metadataFloor(url);
  }
  // Unreachable is not the same as refused — a dead domain shouldn't get a
  // confident-looking card, so those still come back as a failure to fill in.
  if (!result) return failureFor(url, reason);
  onStep("parse");

  // Hero image download/resize/re-host happens later, at save time (createLink) —
  // not here, so an abandoned crawl never uploads anything.
  onStep("images");

  await enrichWithLLM(result);
  onStep("tags");
  return result;
}

/** Plain fetch, falling back to a real headless browser when the site refuses us
 * — either with a block status or by serving a 200 that parses out to nothing
 * (JS-only shells and interstitials both look like that). Anything else (DNS
 * failure, timeout, non-HTML) a browser won't fix either, so it throws through. */
async function fetchAndParse(url: string): Promise<CrawlResult> {
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const parsed = parseHtml(html, finalUrl);
    if (!looksBlocked(parsed)) return parsed;
    // Nothing usable came out of it. The browser gets a go, and failing that the
    // shell goes up as salvage material rather than being served as a card.
    return await parseWithBrowser(url).catch(() => {
      throw new CrawlError("Nothing extractable in the response", "blocked", html);
    });
  } catch (err) {
    if (!(err instanceof CrawlError)) throw err;
    if (err.reason === "blocked") return await parseWithBrowser(url);
    // Amazon and friends answer bots with a 404 rather than a 403, so one browser
    // attempt before believing it. Still 404 there? Then the page really is gone.
    if (err.reason === "not-found") {
      return await parseWithBrowser(url).catch(() => {
        throw err;
      });
    }
    throw err;
  }
}

async function parseWithBrowser(url: string): Promise<CrawlResult> {
  const { html, finalUrl } = await fetchHtmlWithBrowser(url);
  const parsed = parseHtml(html, finalUrl);
  if (looksBlocked(parsed)) throw new CrawlError("Browser render is a block page", "blocked", html);
  return parsed;
}

/** Metadata-only rescue from a page we were refused: og: tags survive on plenty
 * of block pages and a real title is worth more than the URL slug — but a
 * challenge shell must not pass as the real thing. */
function salvage(html: string, url: string): CrawlResult | null {
  try {
    const parsed = parseHtml(html, url);
    if (isChallengeTitle(parsed.title)) return null;
    // Title equal to the domain with nothing around it says no more than the URL.
    if (!parsed.excerpt && !parsed.heroImage && parsed.title === parsed.domain) return null;
    return { ...parsed, articleText: [], excerptOnly: true };
  } catch {
    return null;
  }
}

/** Runs on every crawl: cleans up the extracted article text and has the model
 * take a pass at the metadata (title/excerpt/type/tags/product). With no article
 * text — a blocked page we only have metadata for — it works from the title, the
 * description and the URL alone, which is what makes those cards presentable.
 * Best-effort: never fails the crawl. */
async function enrichWithLLM(result: CrawlResult): Promise<void> {
  const structured = await structureContent({
    url: result.canonicalUrl,
    domain: result.domain,
    title: result.title,
    excerpt: result.excerpt,
    // Only real body text goes here. Passing the description as rawText made the
    // model "reformat" it into an article body that just repeated the excerpt.
    rawText: result.articleText.join("\n\n"),
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
