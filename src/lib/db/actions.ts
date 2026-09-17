"use server";

import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import { reuploadHeroImage, deleteHeroImage } from "../storage/upload-hero-image";
import { crawlUrl } from "../crawler";
import { cleanUrl } from "../crawler/url";
import type { CardSize, LinkItem, ProductDetails } from "../types";

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

export async function createSmartCollection(query: string) {
  const [row] = await db
    .insert(schema.collections)
    .values({
      userId: CURRENT_USER_ID,
      name: query,
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

export type ImportBookmarkResult =
  | { ok: true; link: LinkItem }
  | { ok: false; url: string; title: string; reason: string };

/** One bookmark at a time, from the client — keeps each import within a single
 * request's timeout and gives the UI real per-item progress instead of one big batch. */
export async function importBookmark(
  url: string,
  fallbackTitle: string,
  collectionId: string
): Promise<ImportBookmarkResult> {
  const result = await crawlUrl(url, () => {});
  if ("failed" in result) {
    return { ok: false, url, title: fallbackTitle, reason: result.reason };
  }

  const link = await createLink({
    // the page's own canonical, not the (often stale, often redirecting) bookmark
    url: result.canonicalUrl,
    domain: result.domain,
    title: result.title || fallbackTitle,
    excerpt: result.excerpt,
    articleText: result.articleText,
    heroImage: result.heroImage,
    tint: result.tint,
    stripe: result.stripe,
    initial: result.initial,
    contentType: result.contentType,
    readingTimeMinutes: result.readingTimeMinutes,
    collectionId,
    tags: result.suggestedTags,
    size: "M",
    product: result.product,
  });

  return { ok: true, link };
}
