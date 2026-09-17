import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { checkLinkStatus } from "@/lib/crawler/check-link";

export const maxDuration = 60;

/** Oldest-checked first, a slice per run — the whole library gets covered over a few
 * days without any one request running long. ponytail: bump BATCH if that's too slow. */
const BATCH = 40;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const links = await db
    .select({ id: schema.links.id, url: schema.links.url })
    .from(schema.links)
    .where(and(isNull(schema.links.deletedAt), eq(schema.links.status, "ready")))
    .orderBy(sql`${schema.links.checkedAt} nulls first`, asc(schema.links.checkedAt))
    .limit(BATCH);

  let broken = 0;
  for (const link of links) {
    const httpStatus = await checkLinkStatus(link.url);
    if (httpStatus === 0 || httpStatus >= 400) broken += 1;
    await db
      .update(schema.links)
      .set({ httpStatus, checkedAt: new Date() })
      .where(eq(schema.links.id, link.id));
  }

  return Response.json({ checked: links.length, broken });
}
