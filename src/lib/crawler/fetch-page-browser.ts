import puppeteerCore, { type Browser, type Page } from "puppeteer-core";
import { CrawlError } from "./errors";

const NAV_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// puppeteer-extra-plugin-stealth was tried here and dropped: its clone-deep/merge-deep
// dependency chain breaks under Turbopack whether externalized (missing files) or
// bundled (broken CJS interop) — too fragile to keep. This one-line webdriver patch
// is the single highest-value evasion from that plugin, without the dependency risk.
async function hidePuppeteerFlag(page: Page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
}

async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const executablePath = await chromium.executablePath();
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
  }
  // Local dev has no Lambda-shaped Chromium — use the full `puppeteer` package's
  // own downloaded browser instead (devDependency only, never ships to prod).
  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({ headless: true }) as unknown as Promise<Browser>;
}

/** Renders a page in a real headless browser — the fallback for sites whose
 * bot-detection blocks a plain fetch() even with a browser-shaped User-Agent. */
export async function fetchHtmlWithBrowser(url: string): Promise<{ html: string; finalUrl: string }> {
  let browser: Browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    console.error("[browser-crawl] launch failed:", err);
    throw new CrawlError(`Browser launch failed: ${err instanceof Error ? err.message : err}`, "blocked");
  }

  try {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await hidePuppeteerFlag(page);

    let response;
    try {
      response = await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT_MS });
    } catch (err) {
      console.error("[browser-crawl] navigation failed:", err);
      throw new CrawlError(`Navigation failed: ${err instanceof Error ? err.message : err}`, "blocked");
    }

    if (!response || !response.ok()) {
      throw new CrawlError(`Browser fetch failed with status ${response?.status()}`, "blocked");
    }

    const html = await page.content();
    return { html, finalUrl: page.url() };
  } finally {
    await browser.close();
  }
}
