import { identityForDomain } from "../card-identity";
import type { CrawlResult } from "./types";

/** Last-resort metadata-only fallback for sites that block both a plain fetch and
 * a real headless browser (IP-reputation-level blocking — see PLAN.md risks).
 * microlink.io runs its own infrastructure with different IP reputation, so it
 * gets past blocks our own crawler can't. No article body, just title/image/excerpt —
 * "enough" for sites this hardened, per the product call on how far to chase this. */
export async function fetchMetadataFallback(url: string): Promise<CrawlResult | null> {
  const endpoint = new URL("https://api.microlink.io/");
  endpoint.searchParams.set("url", url);
  if (process.env.MICROLINK_API_KEY) {
    endpoint.searchParams.set("apiKey", process.env.MICROLINK_API_KEY);
  }

  try {
    const res = await fetch(endpoint.toString(), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;

    const json = await res.json();
    if (json.status !== "success" || !json.data) return null;
    const data = json.data;

    const domain = new URL(url).hostname.replace(/^www\./, "");
    const identity = identityForDomain(domain);

    return {
      domain,
      canonicalUrl: typeof data.url === "string" ? data.url : url,
      title: data.title || domain,
      excerpt: data.description || "",
      articleText: [],
      heroImage: data.image?.url,
      favicon: data.logo?.url,
      tint: identity.tint,
      stripe: identity.stripe,
      initial: identity.initial,
      contentType: "article",
      suggestedTags: [],
      excerptOnly: true,
    };
  } catch (err) {
    console.error("metadata fallback (microlink) failed:", err);
    return null;
  }
}
