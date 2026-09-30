import { chatJson } from "../llm";
import type { ContentType } from "../types";

// Enough to summarise and tag from — the body itself comes from Readability, not the model.
const MAX_INPUT_CHARS = 4_000;

export type StructureInput = {
  url: string;
  domain: string;
  title: string;
  excerpt: string;
  rawText: string;
  contentTypeGuess: ContentType;
  existingProduct?: { price?: number; currency?: string; inStock?: boolean };
};

export type StructureResult = {
  title: string;
  excerpt: string;
  contentType: ContentType;
  tags: string[];
  product?: { price?: number; currency?: string; inStock?: boolean };
};

const SYSTEM_PROMPT = `You label crawled web pages for a read-it-later app. Given the start of a page's
extracted text and whatever metadata was already found, return strict JSON with this shape:
{
  "title": string,
  "excerpt": string (a real 1-2 sentence summary, not just the first line),
  "contentType": "article" | "video" | "product",
  "tags": string[] (up to 3 short topical tags),
  "product": { "price": number, "currency": string (ISO code or symbol), "inStock": boolean }
    (only include this field, and only the sub-fields you can actually infer, when
    contentType is "product" — omit entirely otherwise, and omit any sub-field you're not
    confident about rather than guessing)
}
When "rawText" is empty the page refused to be crawled and all you have is its
metadata and URL. Then: clean the title into something a
human would write (drop the site name, SEO padding, ALL-CAPS and marketing noise),
and base the excerpt only on the title, description, domain and URL — say what the
page evidently is, and keep it to one sentence when that is all you can honestly
support. Never invent page content that was not given to you.
Return ONLY the JSON object, no other text.`;

/** Best-effort LLM cleanup/enrichment — returns null on any failure so the caller
 * can fall back to the plain regex/JSON-LD extraction it already has. */
export async function structureContent(input: StructureInput): Promise<StructureResult | null> {
  try {
    const parsed = await chatJson<{
      title?: string;
      excerpt?: string;
      contentType?: ContentType;
      tags?: unknown;
      product?: { price?: number; currency?: string; inStock?: boolean };
    }>(SYSTEM_PROMPT, {
      url: input.url,
      domain: input.domain,
      title: input.title,
      excerpt: input.excerpt,
      contentTypeGuess: input.contentTypeGuess,
      existingProduct: input.existingProduct,
      rawText: input.rawText.slice(0, MAX_INPUT_CHARS),
    },
    // Labelling, not reasoning: with the default effort the model burned its whole
    // token budget thinking and returned nothing on long articles.
    { maxTokens: 600, timeoutMs: 8_000, reasoningEffort: "none" });
    if (!parsed) return null;

    const contentType: ContentType =
      parsed.contentType && ["article", "video", "product"].includes(parsed.contentType)
        ? parsed.contentType
        : input.contentTypeGuess;

    const product =
      contentType === "product" && parsed.product && typeof parsed.product === "object"
        ? {
            price: typeof parsed.product.price === "number" ? parsed.product.price : undefined,
            currency: typeof parsed.product.currency === "string" ? parsed.product.currency : undefined,
            inStock: typeof parsed.product.inStock === "boolean" ? parsed.product.inStock : undefined,
          }
        : undefined;

    return {
      title: typeof parsed.title === "string" && parsed.title ? parsed.title : input.title,
      excerpt: typeof parsed.excerpt === "string" && parsed.excerpt ? parsed.excerpt : input.excerpt,
      contentType,
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter((t: unknown): t is string => typeof t === "string").slice(0, 3)
        : [],
      product,
    };
  } catch (err) {
    console.error("structureContent failed:", err);
    return null;
  }
}
