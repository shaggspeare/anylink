import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
// explicit extensions so `node --test` can load this without a bundler
import { identityForDomain } from "../card-identity.ts";
import { cleanUrl, videoFromUrl } from "./url.ts";
import type { ContentType, ProductDetails, TemplateData } from "../types";
import type { CrawlResult } from "./types";

const VIDEO_DOMAINS = ["youtube.com", "youtu.be", "vimeo.com"];
const WORDS_PER_MINUTE = 225;
const BODY_BLOCKS = "p, li, h2, h3, h4, pre, blockquote";

/** Readability's HTML → one string per block. A DOM walk rather than a <p> regex:
 * keeps lists, headings and code, and decodes entities for free. A block nested in
 * another (p inside li or blockquote) is covered by its outermost one. */
function bodyBlocks(doc: Document, html: string): string[] {
  const root = doc.createElement("div");
  root.innerHTML = html;
  return Array.from(root.querySelectorAll(BODY_BLOCKS))
    .filter((el) => !el.parentElement?.closest(BODY_BLOCKS))
    .map((el) =>
      el.tagName === "PRE" ? (el.textContent ?? "").trim() : (el.textContent ?? "").replace(/\s+/g, " ").trim()
    )
    .filter((text) => text.length > 0);
}

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
  // Ahead of VideoObject: recipe pages often carry one for the recipe's own video.
  if (findByType(jsonLd, ["Recipe"])) return "recipe";
  if (findByType(jsonLd, ["VideoObject"])) return "video";
  if (ogType?.startsWith("video")) return "video";
  if (ogType === "product") return "product";
  return "article";
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.]/g, "")) : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** "1.2K" → 1200, "1,234 reviews" → 1234. Always whole: iOS decodes counts as Int, and one
 * fraction fails the whole library load. */
function asCount(value: unknown): number | undefined {
  const m = String(value ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([km])?/i);
  if (!m) return undefined;
  const scale = !m[2] ? 1 : m[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
  return Math.round(Number(m[1]) * scale);
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
    reviewCount: asCount(rating?.reviewCount ?? rating?.ratingCount),
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
    findByType(jsonLd, ["Article", "NewsArticle", "BlogPosting", "Recipe"]) ??
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

const ISO_DURATION = /^P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)W)?(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/i;
const UNIT_SECONDS = [365 * 86_400, 30 * 86_400, 7 * 86_400, 86_400, 3_600, 60, 1];

/** "PT1H30M" → 5400, "P0DT0H35M" → 2100. Undefined for anything else. Whole seconds: iOS decodes Int. */
export function isoDurationSeconds(value: unknown): number | undefined {
  const parts = typeof value === "string" ? value.trim().replace(/,/g, ".").match(ISO_DURATION)?.slice(1) : undefined;
  if (!parts || parts.every((p) => p === undefined)) return undefined;
  const seconds = parts.reduce((sum, p, i) => sum + Number(p ?? 0) * UNIT_SECONDS[i], 0);
  return Number.isFinite(seconds) ? Math.round(seconds) : undefined;
}

/** Whole minutes; zero reads as unknown. */
function minutes(value: unknown): number | undefined {
  const seconds = isoDurationSeconds(value);
  return seconds ? Math.round(seconds / 60) : undefined;
}

/** A JSON-LD person or organisation: "Ann", { name: "Ann" } or a list of either. */
function nameOf(value: unknown): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  const name = typeof first === "string" ? first : (first as Record<string, unknown> | undefined)?.name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
}

/** Page-supplied text, entities decoded and tags dropped, capped: it's stored and sent to every client. */
function plainText(doc: Document, html: unknown): string {
  const el = doc.createElement("div");
  el.innerHTML = typeof html === "string" ? html : "";
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1_000);
}

const MAX_RECIPE_LINES = 100;

/** HowToStep and HowToSection lists, plain strings, or one blob with a step per line. Section names are dropped. */
function recipeSteps(doc: Document, value: unknown): string[] {
  if (typeof value === "string") return value.split(/\n+/).map((s) => plainText(doc, s)).filter(Boolean);
  if (!Array.isArray(value)) return value && typeof value === "object" ? recipeSteps(doc, [value]) : [];
  return value.flatMap((item) => {
    if (typeof item === "string") return [plainText(doc, item)];
    const node = (item ?? {}) as Record<string, unknown>;
    if (Array.isArray(node.itemListElement)) return recipeSteps(doc, node.itemListElement);
    return [plainText(doc, node.text ?? node.name)];
  }).filter(Boolean);
}

/** `recipeYield` is "4", 4, or ["4", "4 servings"]: the longest says the most. */
function recipeYield(value: unknown): string | undefined {
  return (Array.isArray(value) ? value : [value])
    .map((v) => (typeof v === "number" ? String(v) : typeof v === "string" ? v.trim().slice(0, 100) : ""))
    .sort((a, b) => b.length - a.length)[0] || undefined;
}

/** What the templates need from the page itself (no AI), read before Readability changes the document.
 * Video fields come from the URL, the VideoObject or og:video, and YouTube's microdata; no oEmbed call. */
function templateData(doc: Document, url: string, domain: string, jsonLd: Record<string, unknown>[], type: ContentType): TemplateData {
  const video = findByType(jsonLd, ["VideoObject"]);
  const recipe = findByType(jsonLd, ["Recipe"]);
  const player = [url, video?.embedUrl, getMeta(doc, "property", "og:video:url", "og:video")].map(videoFromUrl).find(Boolean);
  const isVideo = type === "video" || Boolean(player);
  const itemprop = (selector: string) => doc.querySelector(selector)?.getAttribute("content") ?? undefined;
  return {
    ...(player ?? (isVideo ? { provider: domain } : {})),
    ...(isVideo && {
      channel: nameOf(video?.author ?? video?.creator) ?? itemprop('[itemprop="author"] [itemprop="name"]'),
      durationSeconds: isoDurationSeconds(video?.duration ?? itemprop('meta[itemprop="duration"]')),
    }),
    ...(recipe && {
      ingredients: [recipe.recipeIngredient ?? recipe.ingredients].flat().map((i) => plainText(doc, i)).filter(Boolean).slice(0, MAX_RECIPE_LINES),
      steps: recipeSteps(doc, recipe.recipeInstructions).slice(0, MAX_RECIPE_LINES),
      prepMinutes: minutes(recipe.prepTime),
      cookMinutes: minutes(recipe.cookTime),
      totalMinutes: minutes(recipe.totalTime),
      yield: recipeYield(recipe.recipeYield),
    }),
  };
}

/** Undefined and empty lists dropped; nothing left is undefined, so the column stays null. */
function compact(data: TemplateData): TemplateData | undefined {
  const kept = Object.entries(data).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0));
  return kept.length ? Object.fromEntries(kept) : undefined;
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

  const fromPage = templateData(doc, url, domain, jsonLd, contentType);

  // Readability mutates the document, so it runs last.
  const article = new Readability(doc).parse();
  const paragraphs = article?.content ? bodyBlocks(doc, article.content) : [];
  const published = new Date(article?.publishedTime ?? "");

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
    // Every type keeps the byline and date: the model may still call this page an article.
    templateData: compact({
      ...fromPage,
      author: article?.byline?.replace(/^\s*by\s+/i, "").trim() || undefined,
      publishedAt: Number.isNaN(published.getTime()) ? undefined : published.toISOString(),
    }),
  };
}
