import { checkLinks, linksNeedingCheck } from "@/lib/db/check-links";

export const maxDuration = 60;

/** Oldest-checked first, a slice per run — the whole library gets covered over a few
 * days without any one request running long. ponytail: bump BATCH if that's too slow. */
const BATCH = 200;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const links = await linksNeedingCheck(BATCH);
  let broken = 0;
  // Leaves headroom under maxDuration so a slow wave doesn't lose the whole run's writes.
  const { checked } = await checkLinks(
    links,
    (result) => {
      if (result.dead) broken += 1;
    },
    Date.now() + 50_000
  );

  return Response.json({ checked, broken });
}
