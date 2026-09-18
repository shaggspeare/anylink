import type { ContentType } from "../types";

const MODEL = "gpt-5.6-luna";
const MAX_INPUT_CHARS = 20_000;

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
  articleText: string[];
  contentType: ContentType;
  tags: string[];
  product?: { price?: number; currency?: string; inStock?: boolean };
};

const SYSTEM_PROMPT = `You clean up crawled web page content for a read-it-later app. Given a page's raw
extracted text and whatever metadata was already found, return strict JSON with this shape:
{
  "title": string,
  "excerpt": string (a real 1-2 sentence summary, not just the first line),
  "articleText": string[] (the content reformatted into clean, properly-broken paragraphs —
    fix run-on text and stray markup artifacts, keep the actual content and meaning intact,
    do not summarize or drop paragraphs),
  "contentType": "article" | "video" | "product",
  "tags": string[] (up to 3 short topical tags),
  "product": { "price": number, "currency": string (ISO code or symbol), "inStock": boolean }
    (only include this field, and only the sub-fields you can actually infer, when
    contentType is "product" — omit entirely otherwise, and omit any sub-field you're not
    confident about rather than guessing)
}
When "rawText" is empty the page refused to be crawled and all you have is its
metadata and URL. Then: return "articleText": [], clean the title into something a
human would write (drop the site name, SEO padding, ALL-CAPS and marketing noise),
and base the excerpt only on the title, description, domain and URL — say what the
page evidently is, and keep it to one sentence when that is all you can honestly
support. Never invent page content that was not given to you.
Return ONLY the JSON object, no other text.`;

function truncate(text: string): { head: string; tail: string } {
  if (text.length <= MAX_INPUT_CHARS) return { head: text, tail: "" };
  return { head: text.slice(0, MAX_INPUT_CHARS), tail: text.slice(MAX_INPUT_CHARS) };
}

/** Best-effort LLM cleanup/enrichment — returns null on any failure so the caller
 * can fall back to the plain regex/JSON-LD extraction it already has. */
export async function structureContent(input: StructureInput): Promise<StructureResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const { head, tail } = truncate(input.rawText);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        response_format: { type: "json_object" },
        max_completion_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              url: input.url,
              domain: input.domain,
              title: input.title,
              excerpt: input.excerpt,
              contentTypeGuess: input.contentTypeGuess,
              existingProduct: input.existingProduct,
              rawText: head,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      console.error("structureContent: OpenAI request failed", res.status, await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;

    const articleText = Array.isArray(parsed.articleText)
      ? parsed.articleText.filter((p: unknown): p is string => typeof p === "string")
      : [];
    // Never silently drop content the truncated input didn't cover.
    if (tail.trim()) {
      articleText.push(
        ...tail
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
      );
    }

    const contentType: ContentType = ["article", "video", "product"].includes(parsed.contentType)
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
      articleText,
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
