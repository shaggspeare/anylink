import { cache } from "react";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { legibleStripe } from "../card-identity";
import { sortLinks } from "../organize";
import { currentUserId } from "./current-user";
import type {
  Collection,
  Highlight,
  ImportMeta,
  LinkItem,
  PriceSnapshot,
  ProductDetails,
  SharedCollection,
} from "../types";

type ProductJson = Pick<
  ProductDetails,
  "retailer" | "retailerInitial" | "retailerColor" | "code" | "delivery" | "rating" | "reviewCount" | "warranty" | "variants" | "specs" | "totalSpecCount"
>;

/** Every user has exactly one inbox; created lazily on first read so there's no separate
 * provisioning step to keep in sync. Returns its id — imports need somewhere to land. */
export async function ensureInbox(): Promise<string> {
  const uid = await currentUserId();
  const [existing] = await db
    .select({ id: schema.collections.id })
    .from(schema.collections)
    .where(and(eq(schema.collections.userId, uid), eq(schema.collections.isInbox, true)));
  if (existing) return existing.id;

  const [created] = await db
    .insert(schema.collections)
    .values({ userId: uid, name: "Unsorted", color: "#9aa3ad", isInbox: true })
    .returning({ id: schema.collections.id });
  return created.id;
}

export async function getLibraryData(): Promise<{
  links: LinkItem[];
  trashed: LinkItem[];
  collections: Collection[];
  /** What they appear as on shared collections; null until they pick one. */
  displayName: string | null;
}> {
  const uid = await currentUserId();
  await ensureInbox();
  const [user] = await db
    .select({ displayName: schema.users.displayName })
    .from(schema.users)
    .where(eq(schema.users.id, uid));
  const displayName = user?.displayName ?? null;

  const collectionRows = await db
    .select()
    .from(schema.collections)
    .where(eq(schema.collections.userId, uid))
    // Inbox first — it's where unfiled links land, so it's the one opened most.
    .orderBy(
      desc(schema.collections.isInbox),
      asc(schema.collections.position),
      asc(schema.collections.createdAt)
    );

  const linkRows = await db
    .select()
    .from(schema.links)
    .where(eq(schema.links.userId, uid))
    .orderBy(desc(schema.links.createdAt));

  const linkIds = linkRows.map((l) => l.id);
  if (linkIds.length === 0) {
    return { links: [], trashed: [], collections: collectionRows.map(toCollection), displayName };
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

  const allLinks = linkRows.map((row) =>
    toLinkItem(row, {
      tags: tagsByLink.get(row.id),
      highlights: highlightsByLink.get(row.id),
      latest: latestSnapshotByLink.get(row.id),
      history: snapshotsByLink.get(row.id),
      alert: alertByLink.get(row.id),
    })
  );

  // Trashed links travel separately so no existing view has to learn to skip them.
  return {
    displayName,
    collections: collectionRows.map(toCollection),
    links: allLinks.filter((l) => !l.deleted),
    trashed: allLinks.filter((l) => l.deleted),
  };
}

type SnapshotRow = typeof schema.priceSnapshots.$inferSelect;

export function toLinkItem(
  row: typeof schema.links.$inferSelect,
  extra: {
    tags?: string[];
    highlights?: Highlight[];
    latest?: SnapshotRow;
    history?: PriceSnapshot[];
    alert?: typeof schema.priceAlerts.$inferSelect;
  }
): LinkItem {
  const product = row.productData as ProductJson | null;
  const { latest, alert } = extra;
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    excerpt: row.excerpt,
    articleText: row.articleText ?? undefined,
    heroImage: row.heroImage ?? undefined,
    tint: row.tint,
    stripe: legibleStripe(row.tint, row.stripe),
    initial: row.initial,
    contentType: row.contentType,
    readingTimeMinutes: row.readingTimeMinutes ?? undefined,
    collectionId: row.collectionId,
    tags: extra.tags ?? [],
    size: row.size,
    position: row.position,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    source: row.source,
    importMeta: (row.importMeta as ImportMeta | null) ?? undefined,
    note: row.note ?? undefined,
    favorite: row.favorite,
    pinned: row.pinned,
    httpStatus: row.httpStatus ?? undefined,
    archived: row.archivedAt !== null,
    deleted: row.deletedAt !== null,
    highlights: extra.highlights,
    product: product
      ? {
          ...product,
          currency: latest?.currency ?? "$",
          price: latest ? Number(latest.price) : undefined,
          inStock: latest?.inStock ?? undefined,
          priceHistory: extra.history ?? [],
          alertThreshold: alert ? Number(alert.thresholdPrice) : undefined,
        }
      : undefined,
  };
}

/** The live, non-archived links of the collection `token` shares, with each one's latest price.
 * No session: the token is the credential (docs/adr/0001). Null once sharing is off. */
export async function sharedCollectionRows(token: unknown) {
  // Tokens are 22 base64url chars; anything else can't match, so skip the query.
  if (typeof token !== "string" || !/^[\w-]{16,64}$/.test(token)) return null;
  const [collection] = await db
    .select({
      id: schema.collections.id,
      name: schema.collections.name,
      color: schema.collections.color,
      icon: schema.collections.icon,
      ownerName: schema.users.displayName,
    })
    .from(schema.collections)
    .innerJoin(schema.users, eq(schema.users.id, schema.collections.userId))
    .where(eq(schema.collections.shareToken, token));
  if (!collection) return null;

  const rows = await db
    .select()
    .from(schema.links)
    .where(
      and(eq(schema.links.collectionId, collection.id), isNull(schema.links.deletedAt), isNull(schema.links.archivedAt))
    );
  const snapshots = rows.length
    ? await db
        .select()
        .from(schema.priceSnapshots)
        .where(inArray(schema.priceSnapshots.linkId, rows.map((r) => r.id)))
        .orderBy(asc(schema.priceSnapshots.capturedAt))
    : [];
  // Ascending, so the last set() per link is its latest price.
  const latest = new Map(snapshots.map((r) => [r.linkId, r]));
  return { collection, rows, latest };
}

/** What a viewer sees. An allow-list, not a strip-list, so a field added to LinkItem later
 * stays private until someone decides otherwise. */
// cache(): the page and its metadata both ask, once per request.
export const getSharedCollection = cache(async (token: unknown): Promise<SharedCollection | null> => {
  const shared = await sharedCollectionRows(token);
  if (!shared) return null;
  const { collection, rows, latest } = shared;
  return {
    name: collection.name,
    color: collection.color,
    icon: collection.icon ?? undefined,
    ownerName: collection.ownerName ?? undefined,
    // The owner's arrangement — pinned first, then their drag order — so every client shows it as-is.
    links: sortLinks(rows.map((row): LinkItem => {
      const l = toLinkItem(row, { latest: latest.get(row.id) });
      return {
        id: l.id,
        url: l.url,
        domain: l.domain,
        title: l.title,
        excerpt: l.excerpt,
        heroImage: l.heroImage,
        tint: l.tint,
        stripe: l.stripe,
        initial: l.initial,
        contentType: l.contentType,
        readingTimeMinutes: l.readingTimeMinutes,
        collectionId: "",
        tags: [],
        size: l.size,
        position: l.position,
        status: l.status,
        createdAt: l.createdAt,
        note: l.note,
        pinned: l.pinned,
        product: l.product && { ...l.product, priceHistory: [], previousPrice: undefined, alertThreshold: undefined },
      };
    }), "manual"),
  };
});

function toCollection(row: typeof schema.collections.$inferSelect): Collection {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon ?? undefined,
    isSmart: row.isSmart,
    smartQuery: row.smartQuery ?? undefined,
    isInbox: row.isInbox,
    reasoning: row.reasoning ?? undefined,
    createdBy: row.createdBy,
    shareToken: row.shareToken ?? undefined,
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
