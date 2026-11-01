import { checkLinkStatus } from "@/lib/crawler/check-link";
import { verifyAssertion } from "@/lib/db/attest-keys";
import { CONCURRENCY } from "@/lib/db/check-links";
import { isDeadStatus } from "@/lib/link-health";

export const maxDuration = 300;

/** As /api/import/check: stop well short of maxDuration and report what's left. */
const BUDGET_MS = 240_000;
const PER_REQUEST = 600;

type Link = { id: string; url: string; title: string };

function parseLinks(raw: string): Link[] | null {
  try {
    const links = JSON.parse(raw)?.links;
    const valid = (l: Link) => typeof l?.id === "string" && typeof l.url === "string" && typeof l.title === "string";
    return Array.isArray(links) && links.every(valid) ? links.map(({ id, url, title }) => ({ id, url, title })) : null;
  } catch {
    return null;
  }
}

/** The import's dead-link check for an iOS install without an account (docs/adr/0002), signed with App Attest.
 * Body `{ links: [{ id, url, title }] }`; the answer is /api/import/check's NDJSON. Links are checked in order, so
 * `remaining` counts the tail this call didn't reach. Nothing is stored. */
export async function POST(request: Request) {
  const raw = await request.text();
  const links = parseLinks(raw);
  if (!links) return Response.json({ error: "Body must be { links: [{ id, url, title }] }" }, { status: 400 });
  const batch = links.slice(0, PER_REQUEST);

  const denied = await verifyAssertion(request, raw, "check", batch.length);
  if (denied) return denied;

  const deadline = Date.now() + BUDGET_MS;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: object) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      const dead: (Link & { status: number })[] = [];
      let checked = 0;

      try {
        send({ type: "start", total: batch.length });
        for (let i = 0; i < batch.length && Date.now() < deadline; i += CONCURRENCY) {
          const wave = batch.slice(i, i + CONCURRENCY);
          const statuses = await Promise.all(wave.map((link) => checkLinkStatus(link.url)));
          wave.forEach((link, n) => {
            if (isDeadStatus(statuses[n])) dead.push({ ...link, status: statuses[n] });
            checked += 1;
            send({ type: "progress", checked, dead: dead.length });
          });
        }
        send({ type: "done", checked, dead, remaining: links.length - checked });
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
