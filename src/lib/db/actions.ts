"use server";

import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import { reuploadHeroImage, deleteHeroImage } from "../storage/upload-hero-image";
import { cleanUrl, domainFromUrl, titleFromUrl } from "../crawler/url";
import { identityForDomain } from "../card-identity";
import { isDeadStatus } from "../link-health";
import { groupByMetadata, groupLinks, type Priorities } from "../rank/group-links";
import { ensureInbox } from "./queries";
import type { ImportedLink } from "../import/parse";
import type { CardSize, Collection, LinkItem, ProductDetails } from "../types";

type NewLinkInput = Omit<LinkItem, "id" | "createdAt" | "status" | "archived" | "highlights"> & {
  status?: LinkItem["status"];
};

async function tagIdsFor(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await Promise.all(
    names.map((name) =>
      db
        .insert(schema.tags)
        .values({ userId: CURRENT_USER_ID, name })
        .onConflictDoUpdate({
          target: [schema.tags.userId, schema.tags.name],
          set: { name: sql`excluded.name` },
        })
        .returning({ id: schema.tags.id })
    )
  );
  return rows.map(([r]) => r.id);
}

export async function createLink(input: NewLinkInput): Promise<LinkItem> {
  // Last stop before the DB: every save path (add-link form, bookmark import)
  // lands here, so the tracking-param strip belongs here rather than per caller.
  const url = cleanUrl(input.url);

  const productJson: Partial<ProductDetails> | null = input.product
    ? {
        retailer: input.product.retailer,
        retailerInitial: input.product.retailerInitial,
        retailerColor: input.product.retailerColor,
        code: input.product.code,
        delivery: input.product.delivery,
        rating: input.product.rating,
        reviewCount: input.product.reviewCount,
        warranty: input.product.warranty,
        variants: input.product.variants,
        specs: input.product.specs,
        totalSpecCount: input.product.totalSpecCount,
      }
    : null;

  const [row] = await db
    .insert(schema.links)
    .values({
      userId: CURRENT_USER_ID,
      collectionId: input.collectionId,
      url,
      domain: input.domain,
      title: input.title,
      excerpt: input.excerpt,
      articleText: input.articleText ?? null,
      heroImage: input.heroImage ?? null,
      tint: input.tint,
      stripe: input.stripe,
      initial: input.initial,
      contentType: input.contentType,
      readingTimeMinutes: input.readingTimeMinutes ?? null,
      size: input.size,
      status: input.status ?? "ready",
      productData: productJson,
    })
    .returning();

  if (input.product?.price !== undefined) {
    await db.insert(schema.priceSnapshots).values({
      linkId: row.id,
      price: String(input.product.price),
      currency: input.product.currency,
      inStock: input.product.inStock ?? null,
    });
  }

  const tagIds = await tagIdsFor(input.tags);
  if (tagIds.length > 0) {
    await db
      .insert(schema.linkTags)
      .values(tagIds.map((tagId) => ({ linkId: row.id, tagId })))
      .onConflictDoNothing();
  }

  let heroImage = input.heroImage;
  if (heroImage) {
    const rehosted = await reuploadHeroImage(heroImage, row.id, url);
    if (rehosted) {
      heroImage = rehosted;
      await db.update(schema.links).set({ heroImage: rehosted }).where(eq(schema.links.id, row.id));
    }
  }

  return {
    ...input,
    url,
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    heroImage,
  };
}

export async function setLinkSize(id: string, size: CardSize) {
  await db
    .update(schema.links)
    .set({ size, updatedAt: new Date() })
    .where(eq(schema.links.id, id));
}

export async function moveLinks(ids: string[], collectionId: string) {
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ collectionId, updatedAt: new Date() })
    .where(inArray(schema.links.id, ids));
}

export async function tagLinks(ids: string[], tag: string) {
  if (ids.length === 0) return;
  const [tagId] = await tagIdsFor([tag]);
  await db
    .insert(schema.linkTags)
    .values(ids.map((linkId) => ({ linkId, tagId })))
    .onConflictDoNothing();
}

/** Manual order, as dropped by the mosaic: `ids` is the list in its new order.
 *
 * One statement for the whole list on purpose — the client dispatches server actions one
 * at a time, so a call per card would serialize into a roundtrip per card.
 * ponytail: rewrites a position for every card in view on each drop. Fine at personal
 * scale; fractional indexing is the upgrade if a collection ever grows enough to feel it. */
export async function reorderLinks(ids: string[]) {
  if (ids.length === 0) return;
  const rows = ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`);
  await db.execute(sql`
    update ${schema.links} set position = v.position
    from (values ${sql.join(rows, sql`, `)}) as v(id, position)
    where ${schema.links.id} = v.id and ${schema.links.userId} = ${CURRENT_USER_ID}::uuid
  `);
}

export async function archiveLinks(ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(inArray(schema.links.id, ids));
}

export async function setFavorite(id: string, favorite: boolean) {
  await db
    .update(schema.links)
    .set({ favorite, updatedAt: new Date() })
    .where(eq(schema.links.id, id));
}

export async function setNote(id: string, note: string) {
  await db
    .update(schema.links)
    .set({ note: note.trim() || null, updatedAt: new Date() })
    .where(eq(schema.links.id, id));
}

/** Delete means Trash. Nothing leaves the database until purgeLinks. */
export async function deleteLinks(ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(inArray(schema.links.id, ids));
}

export async function restoreLinks(ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(inArray(schema.links.id, ids));
}

export async function purgeLinks(ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(schema.links).where(inArray(schema.links.id, ids));
  await Promise.all(ids.map((id) => deleteHeroImage(id).catch(() => {})));
}

export async function createCollection(name: string, color: string) {
  const [row] = await db
    .insert(schema.collections)
    .values({ userId: CURRENT_USER_ID, name, color })
    .returning();
  return { id: row.id, name: row.name, color: row.color };
}

/** A custom filter: a saved query under a name of the user's choosing. Unnamed ones keep
 * the raw query as their label, which is what the palette used to save. */
export async function createSmartCollection(query: string, name?: string) {
  const [row] = await db
    .insert(schema.collections)
    .values({
      userId: CURRENT_USER_ID,
      name: name?.trim() || query,
      color: "#7c8cff",
      isSmart: true,
      smartQuery: query,
    })
    .returning();
  return { id: row.id, name: row.name, color: row.color, isSmart: true, smartQuery: query };
}

export async function renameCollection(id: string, name: string) {
  await db
    .update(schema.collections)
    .set({ name, updatedAt: new Date() })
    .where(eq(schema.collections.id, id));
}

/** Deleting a collection trashes the links inside it rather than refusing — they're
 * restorable from Trash, so there's no reason to make the user empty it by hand first. */
export async function deleteCollection(id: string): Promise<{ trashedIds: string[] }> {
  const [collection] = await db
    .select({ isSmart: schema.collections.isSmart, isInbox: schema.collections.isInbox })
    .from(schema.collections)
    .where(eq(schema.collections.id, id));
  if (!collection) return { trashedIds: [] };
  if (collection.isInbox) throw new Error("The inbox can't be deleted.");

  let trashedIds: string[] = [];
  if (!collection.isSmart) {
    const trashed = await db
      .update(schema.links)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schema.links.collectionId, id), isNull(schema.links.deletedAt)))
      .returning({ id: schema.links.id });
    trashedIds = trashed.map((l) => l.id);
  }

  await db.delete(schema.collections).where(eq(schema.collections.id, id));
  return { trashedIds };
}

/** Housekeeping for the collections that pile up after a reorganisation. */
export async function deleteEmptyCollections(): Promise<string[]> {
  const nonEmpty = await db
    .selectDistinct({ collectionId: schema.links.collectionId })
    .from(schema.links)
    .where(and(eq(schema.links.userId, CURRENT_USER_ID), isNull(schema.links.deletedAt)));
  const keep = nonEmpty.map((r) => r.collectionId);

  const deleted = await db
    .delete(schema.collections)
    .where(
      and(
        eq(schema.collections.userId, CURRENT_USER_ID),
        eq(schema.collections.isSmart, false),
        eq(schema.collections.isInbox, false),
        keep.length > 0 ? notInArray(schema.collections.id, keep) : sql`true`
      )
    )
    .returning({ id: schema.collections.id });
  return deleted.map((c) => c.id);
}

export async function addHighlight(linkId: string, quote: string) {
  await db.insert(schema.highlights).values({ linkId, userId: CURRENT_USER_ID, quote });
}

export async function setAlertThreshold(linkId: string, threshold: number, currency: string) {
  await db
    .insert(schema.priceAlerts)
    .values({ linkId, thresholdPrice: String(threshold), currency })
    .onConflictDoUpdate({
      target: schema.priceAlerts.linkId,
      set: { thresholdPrice: String(threshold) },
    });
}

/** Postgres caps a statement at 65535 bind parameters; at ~14 columns a row, 500 rows
 * a statement stays an order of magnitude clear of it. */
const INSERT_CHUNK = 500;

export type ImportLinksResult = {
  links: LinkItem[];
  /** Already in the library — counted so the import screen can say so. */
  skipped: number;
};

/** Bulk import: the export file's own title and URL go straight in, no crawl.
 *
 * Crawling here is what made importing a real bookmarks file unusable — a fetch, a
 * possible headless-browser retry and an LLM call per link, serially. The export
 * already carries a title, a folder and a date, which is enough to check, rank and
 * group on; enrichment is a background job afterwards (see V1-DECLUTTER-RANK.md). */
export async function importLinks(items: ImportedLink[]): Promise<ImportLinksResult> {
  if (items.length === 0) return { links: [], skipped: 0 };

  const collectionId = await ensureInbox();

  // No unique index on (user_id, url): duplicates are a thing this app deliberately
  // surfaces (`is:duplicate`), so the import filters rather than the database.
  const existing = await db
    .select({ url: schema.links.url })
    .from(schema.links)
    .where(eq(schema.links.userId, CURRENT_USER_ID));
  const known = new Set(existing.map((row) => row.url));

  const rows = [];
  for (const item of items) {
    const url = cleanUrl(item.url);
    if (known.has(url)) continue;
    known.add(url);

    const domain = domainFromUrl(url);
    const identity = identityForDomain(domain);
    // The date the user saved it, not the date they got round to importing — so a
    // freshly imported library still reads newest-first in a way that means something.
    const savedAt = item.meta.savedAt ? new Date(item.meta.savedAt) : null;
    rows.push({
      userId: CURRENT_USER_ID,
      collectionId,
      url,
      domain,
      title: item.title || titleFromUrl(url),
      tint: identity.tint,
      stripe: identity.stripe,
      initial: identity.initial,
      source: item.source,
      importMeta: item.meta,
      ...(savedAt && !Number.isNaN(savedAt.getTime()) ? { createdAt: savedAt } : {}),
    });
  }

  const inserted: (typeof schema.links.$inferSelect)[] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    inserted.push(...(await db.insert(schema.links).values(rows.slice(i, i + INSERT_CHUNK)).returning()));
  }

  return {
    links: inserted.map((row) => ({
      id: row.id,
      url: row.url,
      domain: row.domain,
      title: row.title,
      excerpt: row.excerpt,
      tint: row.tint,
      stripe: row.stripe,
      initial: row.initial,
      contentType: row.contentType,
      collectionId: row.collectionId,
      tags: [],
      size: row.size,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      source: row.source,
      importMeta: (row.importMeta as ImportedLink["meta"] | null) ?? undefined,
    })),
    skipped: items.length - rows.length,
  };
}

/** Cycled through as system collections are created, so a fresh result screen doesn't
 * come out all one colour. Straight from the design tokens. */
const SYSTEM_COLORS = ["#ff5a1f", "#7c8cff", "#d6f24b", "#e0855a", "#9aa3ad", "#17181b"];

/** Links the grouper is allowed to look at in one pass. Past this they stay in the
 * inbox — see MAX_BATCHES in group-links.ts. */
const GROUP_LIMIT = 600;

export type GroupedResult = { collection: Collection; linkIds: string[]; reasoning: string };

/** The onboarding payoff: everything sitting unsorted gets read against what the user
 * said matters and comes back as a few named collections. Dead links are left out —
 * they've already been checked by this point and nobody wants them ranked. */
export async function groupInbox(priorities: Priorities): Promise<GroupedResult[]> {
  const inboxId = await ensureInbox();

  const rows = await db
    .select({
      id: schema.links.id,
      title: schema.links.title,
      domain: schema.links.domain,
      importMeta: schema.links.importMeta,
      httpStatus: schema.links.httpStatus,
    })
    .from(schema.links)
    .where(
      and(
        eq(schema.links.userId, CURRENT_USER_ID),
        eq(schema.links.collectionId, inboxId),
        isNull(schema.links.deletedAt)
      )
    )
    .limit(GROUP_LIMIT);

  const alive = rows.filter((row) => row.httpStatus === null || !isDeadStatus(row.httpStatus));
  if (alive.length === 0) return [];

  const input = alive.map((row, i) => {
    const meta = (row.importMeta as ImportedLink["meta"] | null) ?? {};
    return { i, title: row.title, domain: row.domain, note: meta.folder ?? meta.context };
  });

  // No model, no key, or a response that didn't survive validation: the export's own
  // folders and domains still make a usable library, which beats showing nothing.
  const grouped = (await groupLinks(input, priorities)) ?? groupByMetadata(input);

  const results: GroupedResult[] = [];
  for (const [i, group] of grouped.entries()) {
    const linkIds = group.indices.map((index) => alive[index].id);
    if (linkIds.length === 0) continue;

    const [row] = await db
      .insert(schema.collections)
      .values({
        userId: CURRENT_USER_ID,
        name: group.name,
        color: SYSTEM_COLORS[i % SYSTEM_COLORS.length],
        reasoning: group.reasoning,
        createdBy: "system",
      })
      .returning();

    await db
      .update(schema.links)
      .set({ collectionId: row.id, updatedAt: new Date() })
      .where(inArray(schema.links.id, linkIds));

    results.push({
      collection: {
        id: row.id,
        name: row.name,
        color: row.color,
        reasoning: row.reasoning ?? undefined,
        createdBy: row.createdBy,
      },
      linkIds,
      reasoning: group.reasoning,
    });
  }

  await logSignal("calibrate", { payload: { ...priorities, collections: results.length } });
  return results;
}

/** Write-only in v1: the record of what the user accepted, rejected and moved, for the
 * calibration phase to learn from later. Never blocks the action it's recording. */
export async function logSignal(
  action: string,
  {
    linkId,
    linkIds,
    collectionId,
    payload,
  }: { linkId?: string; linkIds?: string[]; collectionId?: string; payload?: unknown } = {}
) {
  // A bulk move is one signal per link, not one per gesture — whatever reads this later
  // wants to know about the links, and reconstructing them from a payload is worse.
  const targets = linkIds?.length ? linkIds : [linkId ?? null];
  await db.insert(schema.userSignals).values(
    targets.map((id) => ({
      userId: CURRENT_USER_ID,
      linkId: id,
      collectionId: collectionId ?? null,
      action,
      payload: (payload ?? null) as object | null,
    }))
  );
}
