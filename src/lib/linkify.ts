/** Notes are plain text: no markdown, only links made clickable, the way Telegram does it.
 * Bare `example.com/…` counts as a link too — that's how people type them. */

// A scheme'd URL, or a bare host with a known-ish TLD shape. Trailing punctuation is
// trimmed below rather than in the pattern: "see example.com." means the dot is prose.
const URL_RE = /\bhttps?:\/\/[^\s<>"']+|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"']*)?/gi;
const TRAILING = /[.,;:!?)\]}'"»]+$/;

export type TextPart = { text: string; href?: string };

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let raw = match[0];
    const start = match.index;
    // An email's domain isn't a link on its own.
    if (start > 0 && text[start - 1] === "@") continue;
    const trail = raw.match(TRAILING)?.[0] ?? "";
    // Keep a closing paren that closes one opened inside the URL (wikipedia links).
    const keep = trail.startsWith(")") && raw.includes("(") ? 1 : 0;
    raw = raw.slice(0, raw.length - trail.length + keep);
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: raw, href: /^https?:\/\//i.test(raw) ? raw : `https://${raw}` });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

/** A note's title is its first non-empty line — there's no separate title field to fill in. */
export function noteTitle(text: string, max = 120): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line || "Note";
}
