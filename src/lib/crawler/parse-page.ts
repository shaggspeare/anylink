import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { identityForDomain } from "../card-identity";
import { cleanUrl } from "./url";
import type { ContentType, ProductDetails } from "../types";
import type { CrawlResult } from "./types";

const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com"];
const WORDS_PER_MINUTE = 225;

function getMeta(doc: Document, attr: "property" | "name", ...keys: string[]): string | undefined {
  for (const key of keys) {
    const el = doc.querySelector(`meta[${attr}="${key}"]`);
    const content = el?.getAttribute("content")?.trim();
    if (content) return content;
  }
  return undefined;
}

function extractJsonLd(doc: Document): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && typeof item === "object") {
          const graph = (item as Record<string, unknown>)["@graph"];
          if (Array.isArray(graph)) nodes.push(...graph);
          else nodes.push(item as Record<string, unknown>);
        }
      }
    } catch {
      // malformed JSON-LD is common on the open web — skip it
    }
  });
  return nodes;
}

function nodeTypes(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function findByType(nodes: Record<string, unknown>[], types: string[]) {
  return nodes.find((n) => nodeTypes(n).some((t) => types.includes(t)));
}

function extractFavicon(doc: Document, baseUrl: string): string | undefined {
  const link =
    doc.querySelector('link[rel="icon"]') ??
    doc.querySelector('link[rel="shortcut icon"]') ??
    doc.querySelector('link[rel="apple-touch-icon"]');
  const href = link?.getAttribute("href");
  try {
    return href ? new URL(href, baseUrl).toString() : new URL("/favicon.ico", baseUrl).toString();
  } catch {
    return undefined;
  }
}

function detectContentType(domain: string, jsonLd: Record<string, unknown>[], ogType?: string): ContentType {
  if (VIDEO_DOMAINS.some((d) => domain.includes(d))) return "video";
  if (findByType(jsonLd, ["Product"])) return "product";
  if (findByType(jsonLd, ["VideoObject"])) return "video";
  if (ogType?.startsWith("video")) return "video";
  if (ogType === "product") return "product";
  return "article";
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function extractProduct(domain: string, jsonLd: Record<string, unknown>[]): ProductDetails {
  const productNode = findByType(jsonLd, ["Product"]) ?? {};
  const offerRaw = (productNode as Record<string, unknown>).offers;
  const offer = (Array.isArray(offerRaw) ? offerRaw[0] : offerRaw) as Record<string, unknown> | undefined;
  const rating = (productNode as Record<string, unknown>).aggregateRating as Record<string, unknown> | undefined;
  const identity = identityForDomain(domain);

  return {
    retailer: domain,
    retailerInitial: identity.initial,
    retailerColor: identity.tint,
    price: asNumber(offer?.price),
    currency: (offer?.priceCurrency as string) ?? "$",
    inStock:
      typeof offer?.availability === "string"
        ? offer.availability.toLowerCase().includes("instock")
        : undefined,
    rating: asNumber(rating?.ratingValue),
    reviewCount: asNumber(rating?.reviewCount ?? rating?.ratingCount),
    variants: [],
    specs: [],
    totalSpecCount: 0,
    priceHistory: offer?.price
      ? [{ date: new Date().toISOString().slice(0, 10), price: asNumber(offer.price) ?? 0 }]
      : [],
  };
}

function extractJsonLdImage(jsonLd: Record<string, unknown>[]): string | undefined {
  const node =
    findByType(jsonLd, ["Product"]) ??
    findByType(jsonLd, ["Article", "NewsArticle", "BlogPosting"]) ??
    findByType(jsonLd, ["VideoObject"]);
  const image = (node as Record<string, unknown> | undefined)?.image;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return (first as Record<string, unknown>).url as string | undefined;
  }
  if (image && typeof image === "object") return (image as Record<string, unknown>).url as string | undefined;
  return undefined;
}

function extractTags(doc: Document, jsonLd: Record<string, unknown>[]): string[] {
  const tags = new Set<string>();
  doc.querySelectorAll('meta[property="article:tag"]').forEach((el) => {
    const v = el.getAttribute("content")?.trim();
    if (v) tags.add(v);
  });
  const keywords = getMeta(doc, "name", "keywords");
  keywords?.split(",").forEach((k) => {
    const v = k.trim();
    if (v) tags.add(v);
  });
  const articleNode = findByType(jsonLd, ["Article", "NewsArticle", "BlogPosting"]);
  const nodeKeywords = (articleNode as Record<string, unknown> | undefined)?.keywords;
  if (typeof nodeKeywords === "string") nodeKeywords.split(",").forEach((k) => tags.add(k.trim()));
  if (Array.isArray(nodeKeywords)) nodeKeywords.forEach((k) => typeof k === "string" && tags.add(k.trim()));
  return Array.from(tags)
    .filter(Boolean)
    .slice(0, 3);
}

export function parseHtml(html: string, url: string): CrawlResult {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const identity = identityForDomain(domain);

  const ogTitle = getMeta(doc, "property", "og:title");
  const ogDescription = getMeta(doc, "property", "og:description") ?? getMeta(doc, "name", "description");
  const ogType = getMeta(doc, "property", "og:type");
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute("href");
  const favicon = extractFavicon(doc, url);
  const jsonLd = extractJsonLd(doc);
  const contentType = detectContentType(domain, jsonLd, ogType);
  const suggestedTags = extractTags(doc, jsonLd);
  const heroImageRaw =
    getMeta(doc, "property", "og:image") ??
    getMeta(doc, "name", "twitter:image") ??
    extractJsonLdImage(jsonLd);

  // Readability mutates the document, so it runs last.
  const article = new Readability(doc).parse();
  const paragraphs =
    article?.content
      ?.match(/<p[^>]*>([\s\S]*?)<\/p>/g)
      ?.map((p) => p.replace(/<[^>]+>/g, "").trim())
      .filter((p) => p.length > 0) ?? [];

  const title = ogTitle || article?.title || doc.title || domain;
  const textLength = (article?.textContent ?? "").trim().length;
  const excerptOnly = contentType === "article" && textLength < 200 && Boolean(ogDescription);

  const wordCount = (article?.textContent ?? "").split(/\s+/).filter(Boolean).length;
  const readingTimeMinutes =
    contentType === "article" && wordCount > 0 ? Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE)) : undefined;

  return {
    domain,
    // `url` is already post-redirect; rel=canonical collapses the rest (session
    // ids, variant params, AMP copies) onto the page's own preferred URL.
    canonicalUrl: cleanUrl(canonical ? new URL(canonical, url).toString() : url),
    title,
    excerpt: ogDescription || article?.excerpt || "",
    articleText: paragraphs,
    heroImage: heroImageRaw ? new URL(heroImageRaw, url).toString() : undefined,
    favicon,
    tint: identity.tint,
    stripe: identity.stripe,
    initial: identity.initial,
    contentType,
    suggestedTags,
    readingTimeMinutes,
    excerptOnly,
    product: contentType === "product" ? extractProduct(domain, jsonLd) : undefined,
  };
}
