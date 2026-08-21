"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import * as schema from "./schema";
import { CURRENT_USER_ID } from "./current-user";
import { reuploadHeroImage, deleteHeroImage } from "../storage/upload-hero-image";
import { crawlUrl } from "../crawler";
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
      url: input.url,
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
    const rehosted = await reuploadHeroImage(heroImage, row.id);
    if (rehosted) {
      heroImage = rehosted;
      await db.update(schema.links).set({ heroImage: rehosted }).where(eq(schema.links.id, row.id));
    }
  }

  return {
    ...input,
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

export async function deleteLinks(ids: string[]) {
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

export async function deleteCollection(id: string) {
  const [collection] = await db
    .select({ isSmart: schema.collections.isSmart })
    .from(schema.collections)
    .where(eq(schema.collections.id, id));
  if (!collection) return;

  if (!collection.isSmart) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.links)
      .where(eq(schema.links.collectionId, id));
    if (count > 0) {
      throw new Error(`Move or delete the ${count} link${count > 1 ? "s" : ""} in this collection first.`);
    }
  }

  await db.delete(schema.collections).where(eq(schema.collections.id, id));
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
    url,
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
