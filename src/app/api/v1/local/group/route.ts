import { randomUUID } from "node:crypto";
import { verifyAssertion } from "@/lib/db/attest-keys";
import { GROUP_LIMIT, groupByMetadata, groupLinks, SYSTEM_COLORS, type Priorities } from "@/lib/rank/group-links";

type Link = { id: string; title: string; domain: string; note?: string };

/** Lengths are capped because every character goes into the model's prompt. */
const text = (value: unknown, max = 300) => (typeof value === "string" ? value.slice(0, max) : "");
const texts = (value: unknown) => (Array.isArray(value) ? value.slice(0, 50).map((v) => text(v)) : []);

function parse(raw: string): { links: Link[]; priorities: Priorities } | null {
  try {
    const { links, priorities: p } = JSON.parse(raw) ?? {};
    const valid = (l: Link) => typeof l?.id === "string" && typeof l.title === "string" && typeof l.domain === "string";
    if (!Array.isArray(links) || !links.every(valid)) return null;
    return {
      links: links.slice(0, GROUP_LIMIT).map((l: Link) => ({
        id: l.id,
        title: text(l.title),
        domain: text(l.domain, 100),
        note: text(l.note) || undefined,
      })),
      priorities: {
        focus: text(p?.focus, 1000),
        topics: texts(p?.topics),
        kept: texts(p?.kept),
        killed: texts(p?.killed),
        avoid: text(p?.avoid, 1000),
      },
    };
  } catch {
    return null;
  }
}

/** `groupInbox` for an iOS install without an account (docs/adr/0002), signed with App Attest. Body
 * `{ priorities, links: [{ id, title, domain, note? }] }`; the caller leaves dead links out, as groupInbox does. Answers
 * the same `GroupedResult[]`, with new collection ids for the caller to create. Nothing is stored. */
export async function POST(request: Request) {
  const raw = await request.text();
  const body = parse(raw);
  if (!body) {
    return Response.json({ error: "Body must be { priorities, links: [{ id, title, domain, note? }] }" }, { status: 400 });
  }

  const denied = await verifyAssertion(request, raw, "group");
  if (denied) return denied;

  const { links, priorities } = body;
  const input = links.map(({ title, domain, note }, i) => ({ i, title, domain, note }));
  // No model, no key, or a response that didn't survive validation: folders and domains still group.
  const grouped = (await groupLinks(input, priorities)) ?? groupByMetadata(input);

  return Response.json(
    grouped.map((group, n) => ({
      collection: {
        id: randomUUID(),
        name: group.name,
        color: SYSTEM_COLORS[n % SYSTEM_COLORS.length],
        reasoning: group.reasoning,
        createdBy: "system",
      },
      linkIds: group.indices.map((i) => links[i].id),
      reasoning: group.reasoning,
    }))
  );
}
