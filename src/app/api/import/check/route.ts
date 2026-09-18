import { checkLinks, countNeedingCheck, linksNeedingCheck } from "@/lib/db/check-links";

export const maxDuration = 300;

/** Stop well short of maxDuration and report what's left: the import screen just
 * calls again. A resumable check can't be killed halfway into a bad state. */
const BUDGET_MS = 240_000;
const PER_REQUEST = 600;

/** Checks the links that have never been checked, streaming a line per link so the
 * import screen can count up. NDJSON, same as /api/crawl. */
export async function POST() {
  const links = await linksNeedingCheck(PER_REQUEST);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      const dead: { id: string; url: string; title: string; status: number }[] = [];
      let done = 0;

      try {
        send({ type: "start", total: links.length });
        const { checked } = await checkLinks(
          links,
          ({ id, url, title, status, dead: isDead }) => {
            if (isDead) dead.push({ id, url, title, status });
            done += 1;
            send({ type: "progress", checked: done, dead: dead.length });
          },
          Date.now() + BUDGET_MS
        );
        send({ type: "done", checked, dead, remaining: await countNeedingCheck() });
      } catch (error) {
        send({ type: "failed", reason: error instanceof Error ? error.message : "unknown" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}
