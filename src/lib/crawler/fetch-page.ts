import { CrawlError } from "./errors.ts";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 AnyLinkBot/0.1";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

// Statuses that mean "not you, bot" rather than "no such page" — all worth a
// retry in a real browser. 5xx is in here because bot walls hide behind it too
// (Cloudflare's interstitial is a 503, big retailers throw 500 at plain fetches).
const BLOCKED_STATUSES = new Set([401, 403, 405, 406, 429, 451]);
const isBlockedStatus = (status: number) => BLOCKED_STATUSES.has(status) || status >= 500;

// A plain fetch() sends almost none of these, which is itself a bot signal.
const BROWSER_HEADERS = {
  "User-Agent": USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
};

export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: BROWSER_HEADERS,
      // @ts-expect-error - not in the standard fetch type, but Node's undici respects it
      follow: MAX_REDIRECTS,
    });

    if (isBlockedStatus(res.status)) {
      // Keep the block page — it is often a rendered shell with real og: tags.
      const html = await res.text().catch(() => undefined);
      throw new CrawlError(`Blocked with status ${res.status}`, "blocked", html);
    }
    if (res.status === 404 || res.status === 410) {
      throw new CrawlError(`Not found (${res.status})`, "not-found");
    }
    if (!res.ok) {
      throw new CrawlError(`Request failed with status ${res.status}`, "network");
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new CrawlError(`Unsupported content-type: ${contentType}`, "not-html");
    }

    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch (err) {
    if (err instanceof CrawlError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new CrawlError("Timed out", "timeout");
    }
    throw new CrawlError(err instanceof Error ? err.message : "Network error", "network");
  } finally {
    clearTimeout(timeout);
  }
}
