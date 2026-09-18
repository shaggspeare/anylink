import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import { checkLinkStatus } from "../crawler/check-link";
import { isDeadStatus } from "../link-health";

/** Reachability checking, shared by the nightly cron and the import screen. Both want
 * the same thing — a slice of links, checked and written back — and only differ in how
 * they choose the slice and what they do with the progress. */

export type CheckedLink = { id: string; url: string; title: string; status: number; dead: boolean };

/** In flight at once. A link check is almost entirely waiting, so this is about being
 * polite to the sites being checked, not about local CPU. */
const CONCURRENCY = 24;

/** Oldest-checked first (never-checked before that), which is what both callers want:
 * the cron works through the backlog, the import screen finds its own fresh rows. */
export async function linksNeedingCheck(limit: number) {
  return db
    .select({ id: schema.links.id, url: schema.links.url, title: schema.links.title })
    .from(schema.links)
    .where(
      and(
        eq(schema.links.userId, CURRENT_USER_ID),
        isNull(schema.links.deletedAt),
        eq(schema.links.status, "ready")
      )
    )
    .orderBy(sql`${schema.links.checkedAt} nulls first`, asc(schema.links.checkedAt))
    .limit(limit);
}

export async function countNeedingCheck(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.links)
    .where(
      and(
        eq(schema.links.userId, CURRENT_USER_ID),
        isNull(schema.links.deletedAt),
        eq(schema.links.status, "ready"),
        isNull(schema.links.checkedAt)
      )
    );
  return row?.n ?? 0;
}

/** Checks a batch, writing each result back as it lands. `onChecked` fires per link so
 * a caller can stream progress; `deadline` stops the run early so a long import can be
 * resumed by the next request instead of being killed mid-flight by a function timeout. */
export async function checkLinks(
  links: { id: string; url: string; title: string }[],
  onChecked: (result: CheckedLink) => void,
  deadline = Infinity
): Promise<{ checked: number; stoppedEarly: boolean }> {
  let checked = 0;

  for (let i = 0; i < links.length; i += CONCURRENCY) {
    if (Date.now() > deadline) return { checked, stoppedEarly: true };

    const wave = links.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      wave.map(async (link) => {
        const status = await checkLinkStatus(link.url);
        return { ...link, status, dead: isDeadStatus(status) };
      })
    );

    // One statement a wave, not one a link — 24 round trips to Supabase per wave is
    // slower than the checks themselves. `now()` rather than a bound Date: the driver
    // has no type for a Date inside a raw template and throws on one.
    await db.execute(sql`
      update ${schema.links} set http_status = v.status, checked_at = now()
      from (values ${sql.join(
        results.map((r) => sql`(${r.id}::uuid, ${r.status}::int)`),
        sql`, `
      )}) as v(id, status)
      where ${schema.links.id} = v.id
    `);

    for (const result of results) onChecked(result);
    checked += results.length;
  }

  return { checked, stoppedEarly: false };
}
