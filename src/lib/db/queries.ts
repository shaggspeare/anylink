import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import type {
  Collection,
  Highlight,
  ImportMeta,
  LinkItem,
  PriceSnapshot,
  ProductDetails,
} from "../types";

type ProductJson = Pick<
  ProductDetails,
  "retailer" | "retailerInitial" | "retailerColor" | "code" | "delivery" | "rating" | "reviewCount" | "warranty" | "variants" | "specs" | "totalSpecCount"
>;

/** Every user has exactly one inbox; created lazily on first read so there's no separate
 * provisioning step to keep in sync. Returns its id — imports need somewhere to land. */
export async function ensureInbox(): Promise<string> {
  const [existing] = await db
    .select({ id: schema.collections.id })
    .from(schema.collections)
    .where(and(eq(schema.collections.userId, CURRENT_USER_ID), eq(schema.collections.isInbox, true)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.collections)
    .values({ userId: CURRENT_USER_ID, name: "Unsorted", color: "#9aa3ad", isInbox: true })
    .returning({ id: schema.collections.id });
  return created.id;
}

export async function getLibraryData(): Promise<{
  links: LinkItem[];
  trashed: LinkItem[];
  collections: Collection[];
}> {
  await ensureInbox();

  const collectionRows = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.userId, CURRENT_USER_ID))
    // Inbox first — it's where unfiled links land, so it's the one opened most.
    .orderBy(
      desc(schema.collections.isInbox),
      asc(schema.collections.position),
      asc(schema.collections.createdAt)
    );

  const linkRows = await db
    .select()
    .from(schema.links)
    .where(eq(schema.links.userId, CURRENT_USER_ID))
    .orderBy(desc(schema.links.createdAt));

  const linkIds = linkRows.map((l) => l.id);
  if (linkIds.length === 0) {
    return { links: [], trashed: [], collections: collectionRows.map(toCollection) };
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

  const allLinks: LinkItem[] = linkRows.map((row) => {
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
      position: row.position,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      source: row.source,
      importMeta: (row.importMeta as ImportMeta | null) ?? undefined,
      note: row.note ?? undefined,
      favorite: row.favorite,
      httpStatus: row.httpStatus ?? undefined,
      archived: row.archivedAt !== null,
      deleted: row.deletedAt !== null,
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
  });

  // Trashed links travel separately so no existing view has to learn to skip them.
  return {
    collections: collectionRows.map(toCollection),
    links: allLinks.filter((l) => !l.deleted),
    trashed: allLinks.filter((l) => l.deleted),
  };
}

function toCollection(row: typeof schema.collections.$inferSelect): Collection {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSmart: row.isSmart,
    smartQuery: row.smartQuery ?? undefined,
    isInbox: row.isInbox,
    reasoning: row.reasoning ?? undefined,
    createdBy: row.createdBy,
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
