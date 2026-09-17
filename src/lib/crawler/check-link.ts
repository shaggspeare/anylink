import { USER_AGENT } from "./fetch-page";

const TIMEOUT_MS = 8_000;

/** Returns the HTTP status, or 0 when the host never answered (DNS failure, timeout,
 * connection reset) — every one of those reads as "broken" in the UI. HEAD first
 * because a link check doesn't need the body; some servers reject it, hence the GET. */
export async function checkLinkStatus(url: string): Promise<number> {
  const status = await request(url, "HEAD");
  if (status === 405 || status === 501) return request(url, "GET");
  return status;
}

async function request(url: string, method: "HEAD" | "GET"): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
    });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}
