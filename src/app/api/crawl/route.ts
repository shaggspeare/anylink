import { crawlUrl, type CrawlStep } from "@/lib/crawler";
import { currentUser } from "@/lib/db/current-user";

export const maxDuration = 60;

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Guests crawl too (the demo library previews links), so they get a per-IP budget.
 * ponytail: in memory, per function instance — a Postgres counter if it gets abused. */
const GUEST_CRAWLS_PER_HOUR = 10;
const guestCrawls = new Map<string, number[]>();

function guestLimited(ip: string): boolean {
  const hourAgo = Date.now() - 3_600_000;
  const recent = (guestCrawls.get(ip) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= GUEST_CRAWLS_PER_HOUR) return true;
  guestCrawls.set(ip, [...recent, Date.now()]);
  return false;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!(await currentUser()) && guestLimited(ip)) {
    return Response.json({ error: "Too many previews. Sign in to keep going." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!isValidHttpUrl(url)) {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));

      try {
        const result = await crawlUrl(
          url,
          (step: CrawlStep) => send({ type: "step", step }),
          (preview) => send({ type: "preview", result: preview })
        );
        send("failed" in result ? { type: "failed", ...result } : { type: "done", result });
      } catch {
        send({ type: "failed", failed: true, reason: "network" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
