import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { checkProductPrice } from "@/lib/crawler/check-price";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const products = await db
    .select({ id: schema.links.id, url: schema.links.url })
    .from(schema.links)
    .where(and(eq(schema.links.contentType, "product"), isNull(schema.links.archivedAt)));

  let checked = 0;
  let recorded = 0;

  for (const link of products) {
    checked += 1;
    const result = await checkProductPrice(link.url);
    if (!result) continue;

    await db.insert(schema.priceSnapshots).values({
      linkId: link.id,
      price: String(result.price),
      currency: result.currency,
      inStock: result.inStock ?? null,
    });
    recorded += 1;
  }

  return Response.json({ checked, recorded });
}
