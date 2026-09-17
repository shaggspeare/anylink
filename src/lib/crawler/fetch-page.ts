import { CrawlError } from "./errors";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 AnyLinkBot/0.1";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      // @ts-expect-error - not in the standard fetch type, but Node's undici respects it
      follow: MAX_REDIRECTS,
    });

    if (res.status === 403 || res.status === 429) {
      throw new CrawlError(`Blocked with status ${res.status}`, "blocked");
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
