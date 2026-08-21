import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import type { Collection, Highlight, LinkItem, PriceSnapshot, ProductDetails } from "../types";

type ProductJson = Pick<
  ProductDetails,
  "retailer" | "retailerInitial" | "retailerColor" | "code" | "delivery" | "rating" | "reviewCount" | "warranty" | "variants" | "specs" | "totalSpecCount"
>;

export async function getLibraryData(): Promise<{ links: LinkItem[]; collections: Collection[] }> {
  const collectionRows = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.userId, CURRENT_USER_ID));

  const linkRows = await db
    .select()
    .from(schema.links)
    .where(eq(schema.links.userId, CURRENT_USER_ID))
    .orderBy(desc(schema.links.createdAt));

  const linkIds = linkRows.map((l) => l.id);
  if (linkIds.length === 0) {
    return { links: [], collections: collectionRows.map(toCollection) };
  }

  const [tagRows, highlightRows, snapshotRows, alertRows] = await Promise.all([
    db
      .select({ linkId: schema.linkTags.linkId, name: schema.tags.name })
      .from(schema.linkTags)
      .innerJoin(schema.tags, eq(schema.linkTags.tagId, schema.tags.id))
      .where(inArray(schema.linkTags.linkId, linkIds)),
    db.select().from(schema.highlights).where(inArray(schema.highlights.linkId, linkIds)),
    db
      .select()
      .from(schema.priceSnapshots)
      .where(inArray(schema.priceSnapshots.linkId, linkIds))
      .orderBy(asc(schema.priceSnapshots.capturedAt)),
    db.select().from(schema.priceAlerts).where(inArray(schema.priceAlerts.linkId, linkIds)),
  ]);

  const tagsByLink = groupBy(tagRows, (r) => r.linkId, (r) => r.name);
  const highlightsByLink = groupBy(highlightRows, (r) => r.linkId, (r): Highlight => ({
    id: r.id,
    quote: r.quote,
    note: r.note ?? undefined,
  }));
  const snapshotsByLink = groupBy(snapshotRows, (r) => r.linkId, (r): PriceSnapshot => ({
    date: r.capturedAt.toISOString().slice(0, 10),
    price: Number(r.price),
  }));
  const alertByLink = new Map(alertRows.map((a) => [a.linkId, a]));
  // snapshotRows is ascending by capturedAt, so the last set() per key is the latest snapshot.
  const latestSnapshotByLink = new Map(snapshotRows.map((r) => [r.linkId, r]));

  return {
    collections: collectionRows.map(toCollection),
    links: linkRows.map((row) => {
      const product = row.productData as ProductJson | null;
      const latest = latestSnapshotByLink.get(row.id);
      const alert = alertByLink.get(row.id);

      return {
        id: row.id,
        url: row.url,
        domain: row.domain,
        title: row.title,
        excerpt: row.excerpt,
        articleText: row.articleText ?? undefined,
        heroImage: row.heroImage ?? undefined,
        tint: row.tint,
        stripe: row.stripe,
        initial: row.initial,
        contentType: row.contentType,
        readingTimeMinutes: row.readingTimeMinutes ?? undefined,
        collectionId: row.collectionId,
        tags: tagsByLink.get(row.id) ?? [],
        size: row.size,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        archived: row.archivedAt !== null,
        highlights: highlightsByLink.get(row.id),
        product: product
          ? {
              ...product,
              currency: latest?.currency ?? "$",
              price: latest ? Number(latest.price) : undefined,
              inStock: latest?.inStock ?? undefined,
              priceHistory: snapshotsByLink.get(row.id) ?? [],
              alertThreshold: alert ? Number(alert.thresholdPrice) : undefined,
            }
          : undefined,
      };
    }),
  };
}

function toCollection(row: typeof schema.collections.$inferSelect): Collection {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSmart: row.isSmart,
    smartQuery: row.smartQuery ?? undefined,
  };
}

function groupBy<T, V>(rows: T[], key: (row: T) => string, value: (row: T) => V): Map<string, V[]> {
  const map = new Map<string, V[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(value(row));
    else map.set(k, [value(row)]);
  }
  return map;
}
