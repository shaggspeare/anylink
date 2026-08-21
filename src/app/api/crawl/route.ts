import { crawlUrl, type CrawlStep } from "@/lib/crawler";

export const maxDuration = 60;

function isValidHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
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
        const result = await crawlUrl(url, (step: CrawlStep) => send({ type: "step", step }));
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
