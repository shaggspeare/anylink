import type { ContentType } from "./types";

const TINTS = ["#ff5a1f", "#7c8cff", "#d6f24b", "#9aa3ad", "#17181b", "#e0855a"];
const STRIPES = ["#ffffff", "#17181b", "#d6f24b"];

export type CrawlResult = {
  domain: string;
  title: string;
  excerpt: string;
  heroImage?: string;
  tint: string;
  stripe: string;
  initial: string;
  contentType: ContentType;
  suggestedTags: string[];
  readingTimeMinutes?: number;
  failed?: boolean;
  excerptOnly?: boolean;
};

function hash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TAG_BANK = ["reading", "design", "engineering", "space", "video", "gear", "recipe", "longread"];

/** Deterministic stand-in for the real crawler — enough to make the add flow feel live. */
export function mockCrawl(rawUrl: string): CrawlResult {
  let domain = "example.com";
  try {
    domain = new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    domain = rawUrl.replace(/^https?:\/\//, "").split("/")[0] || domain;
  }

  const h = hash(domain);
  const failed = domain.includes("fails");
  const excerptOnly = domain.includes("paywall");

  let contentType: ContentType = "article";
  if (domain.includes("youtube") || domain.includes("vimeo")) contentType = "video";
  if (domain.includes("rozetka") || domain.includes("shop") || domain.includes("amazon")) {
    contentType = "product";
  }

  const slugTitle = domain
    .split(".")[0]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    domain,
    title: failed ? "" : `Notes from ${slugTitle}`,
    excerpt: failed
      ? ""
      : excerptOnly
        ? "This page is behind a paywall — only the summary could be read."
        : "Crawled summary of the page, ready for a quick edit before it's saved.",
    heroImage: failed ? undefined : `https://picsum.photos/seed/${domain}/900/700`,
    tint: TINTS[h % TINTS.length],
    stripe: STRIPES[h % STRIPES.length],
    initial: domain[0]?.toUpperCase() ?? "?",
    contentType,
    suggestedTags: [TAG_BANK[h % TAG_BANK.length], TAG_BANK[(h + 3) % TAG_BANK.length]],
    readingTimeMinutes: contentType === "article" ? 3 + (h % 8) : undefined,
    failed,
    excerptOnly,
  };
}
