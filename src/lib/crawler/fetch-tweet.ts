import { identityForDomain } from "../card-identity.ts";
import type { CrawlResult } from "./types.ts";

/** The status id in an x.com / twitter.com post URL, or null for anything else on those sites. */
export function tweetId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/^(www\.|mobile\.)?(x|twitter)\.com$/.test(u.hostname)) return null;
    return /\/status(?:es)?\/(\d+)/.exec(u.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** The syndication endpoint's check value, derived from the id the way its own embed script does. */
export function tweetToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

type Syndicated = {
  text?: string;
  user?: { name?: string; screen_name?: string; profile_image_url_https?: string };
  photos?: { url: string }[];
  mediaDetails?: { type: string; media_url_https?: string }[];
};

/** A post on X as a card, from the syndication endpoint that powers embedded tweets — x.com itself
 * bot-walls every crawler. The post's first picture is the hero, so a meme saved from X copies and
 * shares as that picture. A GIF or video post keeps its poster frame. Null when the post can't be read
 * (deleted, protected, or the undocumented endpoint changed), and the normal crawl takes over. */
export async function fetchTweet(url: string): Promise<CrawlResult | null> {
  const id = tweetId(url);
  if (!id) return null;
  try {
    const endpoint = new URL("https://cdn.syndication.twimg.com/tweet-result");
    endpoint.searchParams.set("id", id);
    endpoint.searchParams.set("token", tweetToken(id));
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8_000), headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const tweet = (await res.json()) as Syndicated;
    const text = (tweet.text ?? "").replace(/\s*https:\/\/t\.co\/\w+$/g, "").trim();
    const author = tweet.user?.name ?? tweet.user?.screen_name;
    if (!text && !author) return null;
    const hero = tweet.photos?.[0]?.url ?? tweet.mediaDetails?.find((m) => m.media_url_https)?.media_url_https;
    const domain = "x.com";
    const identity = identityForDomain(domain);
    const firstLine = text.split("\n").find((l) => l.trim())?.trim() ?? "";
    return {
      domain,
      canonicalUrl: `https://x.com/${tweet.user?.screen_name ?? "i"}/status/${id}`,
      title: author ? `${author}: ${firstLine || "post on X"}`.slice(0, 200) : firstLine,
      excerpt: text,
      articleText: text ? [text] : [],
      heroImage: hero,
      favicon: tweet.user?.profile_image_url_https,
      tint: identity.tint,
      stripe: identity.stripe,
      initial: identity.initial,
      contentType: "article",
      suggestedTags: [],
      excerptOnly: true,
    };
  } catch (err) {
    console.error("tweet fetch failed:", err);
    return null;
  }
}
