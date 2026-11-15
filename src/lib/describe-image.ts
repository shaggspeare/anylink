import { chatJson } from "./llm";

export type ImageDescription = {
  /** One short line naming what's in it, a meme by its format and joke: the card title when the user gave none. */
  caption: string;
  /** Every word visible in the image, in reading order, one line per line of text. Empty when there's none. */
  text: string;
  tags: string[];
};

const SYSTEM = `You catalogue images for a personal library of memes, screenshots and photos.
Reply with bare JSON: {"caption": string, "text": string, "tags": string[]}.
- caption: at most 12 words naming what's in the image. For a meme, name the format and the joke
  ("Drake meme: sleeping vs. ignoring the alarm"). No trailing period.
- text: every word visible in the image, in reading order, one line per text block, exactly as written.
  "" when there's no text.
- tags: 2 to 5 lowercase tags someone would search for later ("reaction", "cat", "drake format", "work").
  Prefer the meme's known name when it has one.
Reply in the language the image's text is in; captions for images without text in English.`;

/** What a saved image shows, so it can be found later by what's written on it. Null when the model is off or fails. */
export async function describeImage(webp: Buffer): Promise<ImageDescription | null> {
  const r = await chatJson<Partial<ImageDescription>>(SYSTEM, "Describe this image.", {
    image: { data: webp, mediaType: "image/webp" },
    maxTokens: 1_500,
    timeoutMs: 20_000,
    effort: "low",
  });
  if (!r) return null;
  const caption = typeof r.caption === "string" ? r.caption.trim().slice(0, 120) : "";
  const text = typeof r.text === "string" ? r.text.trim().slice(0, 4_000) : "";
  const tags = Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().toLowerCase().slice(0, 40)).slice(0, 5) : [];
  return caption || text || tags.length ? { caption, text, tags } : null;
}
