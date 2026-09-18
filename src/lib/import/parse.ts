// explicit extension so `node --test src/lib/import/parse.test.ts` resolves this
// without a bundler or a test framework in the way
import { titleFromUrl } from "../crawler/url.ts";

/** Export-file readers. Deliberately regex-and-JSON only — no DOMParser, no jsdom —
 * so the same function runs in the browser (where the file is picked), on the server
 * and under `node --test`. Netscape bookmark HTML isn't well-formed anyway; browsers
 * recover from it differently, a token scan doesn't have to. */

export type ImportSource = "chrome" | "telegram";

export type ImportedLink = {
  url: string;
  title: string;
  source: ImportSource;
  /** Whatever the file knew about it — lands in `links.import_meta` and is the only
   * context the grouper has before anything is crawled. */
  meta: {
    /** Bookmark folder trail, e.g. "Bookmarks bar / Reading / Rust". */
    folder?: string;
    /** When the user saved it, per the export file. */
    savedAt?: string;
    /** The Telegram message the link was posted in, minus the URL itself. */
    context?: string;
  };
};

/** One import can't be allowed to run the browser out of memory on a pathological
 * file. ponytail: raise it when someone actually has more than this. */
const MAX_LINKS = 5000;

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === "#") {
      const code = Number(
        body[1] === "x" || body[1] === "X" ? `0x${body.slice(2)}` : body.slice(1)
      );
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

function text(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

// A folder heading, a link, or the close of a folder's list — the only three tokens
// that move the parser. Everything else in the file is ignorable chrome.
const BOOKMARK_TOKEN = /<h3[^>]*>([\s\S]*?)<\/h3>|<a\s([^>]*)>([\s\S]*?)<\/a>|<\/dl>/gi;
const HREF = /\bhref\s*=\s*["']([^"']*)["']/i;
const ADD_DATE = /\badd_date\s*=\s*["'](\d+)["']/i;

/** Netscape bookmark HTML — what Chrome, Firefox, Safari and Edge all export.
 * `<H3>` opens a folder, `</DL>` closes one, so a stack over those two gives each
 * link its folder trail. Also handles a Telegram *HTML* export well enough to be
 * worth pointing at one: it's anchors in a file either way. */
export function parseBookmarks(html: string, source: ImportSource = "chrome"): ImportedLink[] {
  const folders: string[] = [];
  const seen = new Set<string>();
  const links: ImportedLink[] = [];

  for (const match of html.matchAll(BOOKMARK_TOKEN)) {
    const [token, heading, attrs, label] = match;

    if (heading !== undefined) {
      folders.push(text(heading));
      continue;
    }
    if (token.toLowerCase() === "</dl>") {
      folders.pop();
      continue;
    }

    const url = decodeEntities(attrs.match(HREF)?.[1] ?? "").trim();
    // javascript:, place:, chrome:// and data: bookmarks are all real and all useless.
    if (!isHttpUrl(url) || seen.has(url)) continue;
    seen.add(url);

    const addDate = attrs.match(ADD_DATE)?.[1];
    links.push({
      url,
      title: text(label) || titleFromUrl(url),
      source,
      meta: {
        // An unnamed folder still has to occupy the stack so its `</DL>` pops the
        // right level — it just contributes nothing to the trail.
        folder: folders.filter(Boolean).join(" / ") || undefined,
        savedAt: addDate ? new Date(Number(addDate) * 1000).toISOString() : undefined,
      },
    });
    if (links.length >= MAX_LINKS) break;
  }

  return links;
}

type TelegramEntity = { type?: string; text?: string; href?: string };
type TelegramMessage = { date?: string; text_entities?: TelegramEntity[] };

// A bare URL is "link" in a Telegram Desktop export and "url" in the Bot API shape;
// a hyperlink is "text_link" in both and carries the target in `href`.
const LINK_ENTITIES = new Set(["link", "url", "text_link"]);
// Of those, only the bare ones have the URL itself as their visible text. A
// text_link's label is prose the user wrote, so it reads as part of the message.
const URL_AS_TEXT = new Set(["link", "url"]);

/** Telegram Desktop's `result.json`. Accepts both a Saved Messages export (messages
 * at the top level) and a full export (every chat under `chats.list`), in which case
 * only Saved Messages is read — the brief's source, and the only chat that is
 * unambiguously the user's own shelf. */
export function parseTelegram(json: string): ImportedLink[] {
  const root = JSON.parse(json) as {
    messages?: TelegramMessage[];
    chats?: { list?: { type?: string; messages?: TelegramMessage[] }[] };
  };

  const messages =
    root.messages ??
    root.chats?.list
      ?.filter((chat) => chat.type === "saved_messages")
      .flatMap((chat) => chat.messages ?? []) ??
    [];

  const seen = new Set<string>();
  const links: ImportedLink[] = [];

  for (const message of messages) {
    const entities = message.text_entities ?? [];
    const urls = entities
      .filter((e) => LINK_ENTITIES.has(e.type ?? ""))
      .map((e) => (e.href || e.text || "").trim())
      .filter(isHttpUrl);
    if (urls.length === 0) continue;

    // What the user typed around the link, which is the closest thing Telegram has
    // to a bookmark folder. Capped: it's a hint for the grouper, not a document.
    const context = entities
      .filter((e) => !URL_AS_TEXT.has(e.type ?? ""))
      .map((e) => e.text ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    for (const url of urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      links.push({
        url,
        title: context.split(/[.!?\n]/)[0]?.trim().slice(0, 120) || titleFromUrl(url),
        source: "telegram",
        meta: {
          savedAt: message.date ? new Date(message.date).toISOString() : undefined,
          context: context || undefined,
        },
      });
      if (links.length >= MAX_LINKS) return links;
    }
  }

  return links;
}

/** Picks the reader by what the file is, so the UI can take both exports through one
 * file input and merge whatever comes back. */
export function parseImportFile(fileName: string, contents: string): ImportedLink[] {
  if (/\.json$/i.test(fileName)) return parseTelegram(contents);
  // A Telegram HTML export is anchors in a file, same as a bookmarks one.
  return parseBookmarks(contents, /telegram|messages/i.test(fileName) ? "telegram" : "chrome");
}

/** Merge across files: first occurrence of a URL wins, so re-importing the same
 * export twice in one sitting doesn't double anything up. */
export function mergeImports(batches: ImportedLink[][]): ImportedLink[] {
  const byUrl = new Map<string, ImportedLink>();
  for (const batch of batches) {
    for (const link of batch) if (!byUrl.has(link.url)) byUrl.set(link.url, link);
  }
  return [...byUrl.values()].slice(0, MAX_LINKS);
}
