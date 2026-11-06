"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { after } from "next/server";
import { getT } from "@/i18n/server";
import { db } from "./client";
import * as schema from "./schema";
import { currentPlan, currentUserId, fullCrawls } from "./current-user";
import { isPro, PRO_REQUIRED } from "../plan";
import { reuploadHeroImage, deleteHeroImage, uploadImage, copyStoredImage } from "../storage/upload-hero-image";
import { HERO_IMAGES_BUCKET, supabaseAdmin } from "../storage/client";
import { noteTitle } from "../linkify";
import { cleanUrl, domainFromUrl, titleFromUrl } from "../crawler/url";
import { crawlUrl, enrichWithLLM, type CrawlResult } from "../crawler";
import { IMAGE_IDENTITY, NOTE_IDENTITY, identityForDomain } from "../card-identity";
import { isDeadStatus } from "../link-health";
import { GROUP_LIMIT, groupByMetadata, groupLinks, SYSTEM_COLORS, type Priorities } from "../rank/group-links";
import { ensureInbox, getLink, sharedCollectionRows, toLinkItem } from "./queries";
import { linkMatcher, matchCollection, mergeLinks, type MergeFields } from "../library-merge";
import type { ImportedLink } from "../import/parse";
import { CARD_SIZES, type CardSize, type Collection, type ImportMeta, type LinkItem, type ProductDetails, type TemplateData } from "../types";

type NewLinkInput = Omit<LinkItem, "id" | "createdAt" | "status" | "archived" | "highlights"> & {
  status?: LinkItem["status"];
};

/** Empty, or "unsorted" — the placeholder clients use before their collections load: the user's inbox. */
async function collectionOrInbox(id?: string): Promise<string> {
  return id && id !== "unsorted" ? id : ensureInbox();
}

/** The subset of `ids` that are this user's — for writes to tables that only carry a link id. */
async function ownedLinkIds(uid: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)));
  return rows.map((r) => r.id);
}

async function tagIdsFor(uid: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const rows = await Promise.all(
    names.map((name) =>
      db
        .insert(schema.tags)
        .values({ userId: uid, name })
        .onConflictDoUpdate({
          target: [schema.tags.userId, schema.tags.name],
          set: { name: sql`excluded.name` },
        })
        .returning({ id: schema.tags.id })
    )
  );
  return rows.map(([r]) => r.id);
}

function productJson(product?: ProductDetails): Partial<ProductDetails> | null {
  return product
    ? {
        retailer: product.retailer,
        retailerInitial: product.retailerInitial,
        retailerColor: product.retailerColor,
        code: product.code,
        delivery: product.delivery,
        rating: product.rating,
        reviewCount: product.reviewCount,
        warranty: product.warranty,
        variants: product.variants,
        specs: product.specs,
        totalSpecCount: product.totalSpecCount,
      }
    : null;
}

async function savePrice(linkId: string, product?: ProductDetails) {
  if (product?.price === undefined) return;
  await db.insert(schema.priceSnapshots).values({
    linkId,
    price: String(product.price),
    currency: product.currency,
    inStock: product.inStock ?? null,
  });
}

async function addTags(uid: string, linkId: string, names: string[]) {
  const tagIds = await tagIdsFor(uid, names);
  if (tagIds.length > 0) {
    await db
      .insert(schema.linkTags)
      .values(tagIds.map((tagId) => ({ linkId, tagId })))
      .onConflictDoNothing();
  }
}

export async function createLink(input: NewLinkInput): Promise<LinkItem> {
  const uid = await currentUserId();
  // Last stop before the DB: every save path (add-link form, bookmark import)
  // lands here, so the tracking-param strip belongs here rather than per caller.
  const url = cleanUrl(input.url);
  // Saved before anything read the page: the iOS share sheet, or "Save now" mid-read.
  const unread = !input.excerpt && !input.articleText?.length;
  // The crawl behind this save ran with this plan, so a free one skipped the AI step: enrichLink adds it later.
  const full = await fullCrawls();

  const [row] = await db
    .insert(schema.links)
    .values({
      userId: uid,
      collectionId: await collectionOrInbox(input.collectionId),
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
      status: input.status ?? (unread ? "crawling" : "ready"),
      productData: productJson(input.product),
      templateData: input.templateData ?? null,
      source: input.source || undefined,
      note: input.note?.trim() || null,
      aiPending: !full,
    })
    .returning();

  await savePrice(row.id, input.product);
  await addTags(uid, row.id, input.tags);
  // Read now: after() runs outside the request.
  if (unread) after(() => fillFromPage(uid, row.id, url, input.title, full));

  // Download/resize/upload runs after the response: the card shows the hotlinked
  // image now and picks up the re-hosted copy on the next load.
  const heroImage = input.heroImage;
  if (heroImage) {
    after(async () => {
      const rehosted = await reuploadHeroImage(heroImage, row.id, url);
      if (rehosted) {
        await db.update(schema.links).set({ heroImage: rehosted }).where(eq(schema.links.id, row.id));
      }
    });
  }

  return {
    ...input,
    url,
    id: row.id,
    collectionId: row.collectionId,
    source: row.source,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    heroImage,
    pinned: row.pinned,
    aiPending: row.aiPending,
  };
}

/** Reads a link saved unread and fills in its card after the response — the same crawl the add-link
 * form runs first. A title the client sent stays, unless it's only the URL or domain. Ends "ready"
 * either way: a page that can't be read keeps what it was saved with. Without `full` (`fullCrawls`) it's a free crawl,
 * which leaves the link `aiPending`; with it, the AI step was the one try it gets. */
async function fillFromPage(uid: string, id: string, url: string, sentTitle: string, full: boolean) {
  let patch: Partial<typeof schema.links.$inferInsert> = {};
  try {
    const r = await crawlUrl(url, { ai: full, browser: full }, () => {});
    if ("failed" in r) return;
    const placeholder = !sentTitle || [url, r.domain, domainFromUrl(url)].includes(sentTitle);
    patch = {
      ...(placeholder && r.title ? { title: r.title } : {}),
      canonicalUrl: r.canonicalUrl,
      excerpt: r.excerpt,
      articleText: r.articleText,
      heroImage: r.heroImage ? ((await reuploadHeroImage(r.heroImage, id, url)) ?? r.heroImage) : null,
      tint: r.tint,
      stripe: r.stripe,
      initial: r.initial,
      contentType: r.contentType,
      readingTimeMinutes: r.readingTimeMinutes ?? null,
      productData: productJson(r.product),
      templateData: r.templateData ?? null,
    };
    await savePrice(id, r.product);
    await addTags(uid, id, r.suggestedTags);
  } catch (err) {
    console.error("fillFromPage", url, err);
  } finally {
    await db
      .update(schema.links)
      .set({ ...patch, status: "ready", aiPending: !full, updatedAt: new Date() })
      .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
  }
}

/** The AI step for a link saved without it (`aiPending`: a free crawl, or an upload), the first time a Pro account opens
 * it. Run on what the link has stored, it answers the link as it is now; a link with nothing stored is read again after
 * the response, as an unread save is, and answers null like a link with nothing to do. Lifetime past its fair use
 * waits for next month. Pro only.
 * ponytail: lazy backfill bounds AI cost; backfill in bulk if users ask. */
export async function enrichLink(id: string): Promise<LinkItem | null | typeof PRO_REQUIRED> {
  const uid = await currentUserId();
  if (!isPro(await currentPlan())) return PRO_REQUIRED;
  const [row] = await db
    .select()
    .from(schema.links)
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
  if (!row?.aiPending || !(await fullCrawls())) return null;
  if (!row.articleText?.length && !row.excerpt) {
    // Long enough to hold up every other action the web app sends meanwhile: they go one at a time.
    after(() => fillFromPage(uid, row.id, row.url, row.title, true));
    return null;
  }
  const result: CrawlResult = {
    domain: row.domain,
    canonicalUrl: row.canonicalUrl ?? row.url,
    title: row.title,
    excerpt: row.excerpt,
    articleText: row.articleText ?? [],
    tint: row.tint,
    stripe: row.stripe,
    initial: row.initial,
    contentType: row.contentType,
    suggestedTags: [],
  };
  // The model didn't answer: it's asked again the next time the link opens.
  if (!(await enrichWithLLM(result))) return null;
  // The summary is the excerpt. A page that turns out to be a product gets the card a Pro save would have made.
  const product = result.contentType === "product" && !row.productData ? result.product : undefined;
  await db
    .update(schema.links)
    .set({
      excerpt: result.excerpt,
      contentType: result.contentType,
      ...(product ? { productData: productJson(product) } : {}),
      aiPending: false,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
  await addTags(uid, id, result.suggestedTags);
  await savePrice(id, product);
  return getLink(id);
}

const MAX_NOTE_CHARS = 20_000;

function toItem(row: typeof schema.links.$inferSelect): LinkItem {
  return {
    id: row.id,
    url: row.url,
    domain: row.domain,
    title: row.title,
    excerpt: row.excerpt,
    heroImage: row.heroImage ?? undefined,
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
    note: row.note ?? undefined,
    pinned: row.pinned,
  };
}

async function cleanNoteText(text: unknown): Promise<string> {
  const t = await getT();
  if (typeof text !== "string" || !text.trim()) throw new Error(t("A note needs some text."));
  if (text.length > MAX_NOTE_CHARS) throw new Error(t("That note is too long."));
  return text.trim();
}

export async function createNote(text: string, collectionId?: string, source = "manual"): Promise<LinkItem> {
  const uid = await currentUserId();
  const body = await cleanNoteText(text);
  const [row] = await db
    .insert(schema.links)
    .values({
      ...NOTE_IDENTITY,
      userId: uid,
      collectionId: await collectionOrInbox(collectionId),
      url: "",
      title: noteTitle(body),
      excerpt: body,
      contentType: "note",
      source,
    })
    .returning();
  return toItem(row);
}

/** A note's text is the note, so editing it re-derives the title too. */
export async function setNoteText(id: string, text: string) {
  const uid = await currentUserId();
  const body = await cleanNoteText(text);
  await db
    .update(schema.links)
    .set({ title: noteTitle(body), excerpt: body, updatedAt: new Date() })
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid), eq(schema.links.contentType, "note")));
}

/** Base64, not FormData: the iOS app reaches every action as a JSON array of arguments
 * (api/v1/actions), so one shape serves both clients. */
export async function createImage(
  base64: string,
  collectionId?: string,
  caption?: string,
  source = "manual"
): Promise<LinkItem> {
  const uid = await currentUserId();
  const t = await getT();
  if (typeof base64 !== "string" || !base64) throw new Error(t("No image to save."));
  const bytes = Buffer.from(base64.replace(/^data:[^,]*,/, ""), "base64");
  const title = caption?.trim() || "Image";
  const [row] = await db
    .insert(schema.links)
    .values({
      ...IMAGE_IDENTITY,
      userId: uid,
      collectionId: await collectionOrInbox(collectionId),
      url: "",
      title: title.slice(0, 200),
      contentType: "image",
      source,
    })
    .returning();
  try {
    const url = await uploadImage(bytes, row.id);
    const [saved] = await db
      .update(schema.links)
      .set({ url, heroImage: url })
      .where(eq(schema.links.id, row.id))
      .returning();
    return toItem(saved);
  } catch (err) {
    // No half-saved card: a row without its file would be a blank tile forever.
    await db.delete(schema.links).where(eq(schema.links.id, row.id));
    throw err;
  }
}

export async function setLinkSize(id: string, size: CardSize) {
  const uid = await currentUserId();
  await db
    .update(schema.links)
    .set({ size, updatedAt: new Date() })
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
}

export async function moveLinks(ids: string[], collectionId: string) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ collectionId, updatedAt: new Date() })
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)));
}

export async function tagLinks(ids: string[], tag: string) {
  const uid = await currentUserId();
  ids = await ownedLinkIds(uid, ids);
  if (ids.length === 0) return;
  const [tagId] = await tagIdsFor(uid, [tag]);
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
  const uid = await currentUserId();
  if (ids.length === 0) return;
  const rows = ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`);
  await db.execute(sql`
    update ${schema.links} set position = v.position
    from (values ${sql.join(rows, sql`, `)}) as v(id, position)
    where ${schema.links.id} = v.id and ${schema.links.userId} = ${uid}::uuid
  `);
}

export async function reorderCollections(ids: string[]) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  const rows = ids.map((id, i) => sql`(${id}::uuid, ${i}::int)`);
  await db.execute(sql`
    update ${schema.collections} set position = v.position
    from (values ${sql.join(rows, sql`, `)}) as v(id, position)
    where ${schema.collections.id} = v.id and ${schema.collections.userId} = ${uid}::uuid
  `);
}

export async function archiveLinks(ids: string[]) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ archivedAt: new Date(), pinned: false, updatedAt: new Date() })
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)));
}

/** Serialize pin changes per user so simultaneous web/iOS requests cannot exceed two. */
export async function setPinned(id: string, pinned: boolean): Promise<{ ok: boolean }> {
  const uid = await currentUserId();
  if (typeof id !== "string" || typeof pinned !== "boolean") throw new Error("Invalid pin request.");
  return db.transaction(async (tx) => {
    await tx.select({ id: schema.users.id }).from(schema.users)
      .where(eq(schema.users.id, uid)).for("update");
    const [link] = await tx.select().from(schema.links)
      .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid))).for("update");
    if (!link || (pinned && (link.deletedAt || link.archivedAt))) {
      const t = await getT();
      throw new Error(t("This link is no longer in your library."));
    }
    if (pinned && !link.pinned) {
      const existing = await tx.select({ id: schema.links.id }).from(schema.links)
        .where(and(eq(schema.links.userId, uid), eq(schema.links.pinned, true),
          isNull(schema.links.deletedAt), isNull(schema.links.archivedAt))).limit(2);
      if (existing.length >= 2) return { ok: false };
    }
    await tx.update(schema.links).set({ pinned, updatedAt: new Date() })
      .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
    return { ok: true };
  });
}

export async function setFavorite(id: string, favorite: boolean) {
  const uid = await currentUserId();
  await db
    .update(schema.links)
    .set({ favorite, updatedAt: new Date() })
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
}

export async function setNote(id: string, note: string) {
  const uid = await currentUserId();
  await db
    .update(schema.links)
    .set({ note: note.trim() || null, updatedAt: new Date() })
    .where(and(eq(schema.links.id, id), eq(schema.links.userId, uid)));
}

/** Delete means Trash. Nothing leaves the database until purgeLinks. */
export async function deleteLinks(ids: string[]) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ deletedAt: new Date(), pinned: false, updatedAt: new Date() })
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)));
}

export async function restoreLinks(ids: string[]) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  await db
    .update(schema.links)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)));
}

export async function purgeLinks(ids: string[]) {
  const uid = await currentUserId();
  if (ids.length === 0) return;
  const purged = await db
    .delete(schema.links)
    .where(and(inArray(schema.links.id, ids), eq(schema.links.userId, uid)))
    .returning({ id: schema.links.id });
  await Promise.all(purged.map(({ id }) => deleteHeroImage(id).catch(() => {})));
}

export async function createCollection(name: string, color: string, icon?: string | null) {
  const uid = await currentUserId();
  // One emoji, maybe with modifiers; anything longer isn't an icon.
  const safeIcon = icon && [...icon].length <= 8 ? icon : null;
  const [row] = await db
    .insert(schema.collections)
    .values({ userId: uid, name, color, icon: safeIcon })
    .returning();
  return { id: row.id, name: row.name, color: row.color, icon: row.icon ?? undefined };
}

/** A custom filter: a saved query under a name of the user's choosing. Unnamed ones keep
 * the raw query as their label, which is what the palette used to save. */
export async function createSmartCollection(query: string, name?: string) {
  const uid = await currentUserId();
  const [row] = await db
    .insert(schema.collections)
    .values({
      userId: uid,
      name: name?.trim() || query,
      color: "#7c8cff",
      isSmart: true,
      smartQuery: query,
    })
    .returning();
  return { id: row.id, name: row.name, color: row.color, isSmart: true, smartQuery: query };
}

export async function renameCollection(id: string, name: string) {
  const uid = await currentUserId();
  await db
    .update(schema.collections)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(schema.collections.id, id), eq(schema.collections.userId, uid)));
}

/** Dissolves a collection: its links — trashed ones too — go back to Unsorted first,
 * because `links.collection_id` cascades and deleting the row would take them with it.
 * `trashedIds` is always empty now; it stays in the shape the iOS client decodes. */
export async function deleteCollection(id: string): Promise<{ trashedIds: string[] }> {
  const uid = await currentUserId();
  const [collection] = await db
    .select({ isSmart: schema.collections.isSmart, isInbox: schema.collections.isInbox })
    .from(schema.collections)
    .where(and(eq(schema.collections.id, id), eq(schema.collections.userId, uid)));
  if (!collection) return { trashedIds: [] };
  const t = await getT();
  if (collection.isInbox) throw new Error(t("The inbox can't be deleted."));

  if (!collection.isSmart) {
    const [inbox] = await db
      .select({ id: schema.collections.id })
      .from(schema.collections)
      .where(and(eq(schema.collections.userId, uid), eq(schema.collections.isInbox, true)));
    if (!inbox) throw new Error(t("No Unsorted collection to move the links into."));
    await db
      .update(schema.links)
      .set({ collectionId: inbox.id, updatedAt: new Date() })
      .where(and(eq(schema.links.collectionId, id), eq(schema.links.userId, uid)));
  }

  await db.delete(schema.collections).where(and(eq(schema.collections.id, id), eq(schema.collections.userId, uid)));
  return { trashedIds: [] };
}

/** Sharing on keeps an existing token (so a retried call can't break a link already sent);
 * sharing off drops it, so the old URL is dead for good (docs/adr/0001). The inbox and
 * filters can't be shared. Turning it on is Pro; anyone can turn it off. */
export async function setCollectionShared(
  id: string,
  shared: boolean
): Promise<{ shareToken: string | null } | typeof PRO_REQUIRED> {
  const uid = await currentUserId();
  if (shared && !isPro(await currentPlan())) return PRO_REQUIRED;
  const fresh = randomBytes(16).toString("base64url");
  const [row] = await db
    .update(schema.collections)
    .set({
      shareToken: shared ? sql`coalesce(${schema.collections.shareToken}, ${fresh})` : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.collections.id, id),
        eq(schema.collections.userId, uid),
        eq(schema.collections.isSmart, false),
        eq(schema.collections.isInbox, false)
      )
    )
    .returning({ shareToken: schema.collections.shareToken });
  const t = await getT();
  if (!row) throw new Error(t("Only your own collections can be shared — not Unsorted or a filter."));
  return { shareToken: row.shareToken };
}

/** Blank clears it: shared pages then show no owner line. */
export async function setDisplayName(name: string): Promise<string | null> {
  const uid = await currentUserId();
  const clean = typeof name === "string" ? name.trim().slice(0, 40) || null : null;
  await db.update(schema.users).set({ displayName: clean }).where(eq(schema.users.id, uid));
  return clean;
}

/** A viewer's Save from a shared collection: `linkIds` go to their inbox; no ids copies the
 * whole collection into a new one of the same name. Copies keep the crawled data and the
 * current price but not the owner's note, and owe the original nothing (docs/adr/0001). */
export async function saveFromShare(
  token: string,
  linkIds?: string[] | null
): Promise<{ links: LinkItem[]; collection?: Collection }> {
  const uid = await currentUserId();
  const shared = await sharedCollectionRows(token);
  const t = await getT();
  if (!shared) throw new Error(t("This collection isn't shared any more."));
  const wanted = Array.isArray(linkIds) ? new Set(linkIds) : null;
  const rows = wanted ? shared.rows.filter((r) => wanted.has(r.id)) : shared.rows;
  if (wanted && rows.length === 0) throw new Error(t("That link isn't in this collection any more."));

  let collection: Collection | undefined;
  if (!wanted) {
    const { name, color, icon } = shared.collection;
    const [made] = await db.insert(schema.collections).values({ userId: uid, name, color, icon }).returning();
    collection = { id: made.id, name: made.name, color: made.color, icon: made.icon ?? undefined };
  }
  const collectionId = collection?.id ?? (await ensureInbox());

  // Ids up front so each copy's stored image can be copied under its new name first.
  const copies = await Promise.all(
    rows.map(async (r) => {
      const id = randomUUID();
      const image = r.heroImage ? await copyStoredImage(r.heroImage, r.id, id) : undefined;
      return {
        id,
        userId: uid,
        collectionId,
        url: r.contentType === "image" && image ? image : r.url,
        canonicalUrl: r.canonicalUrl,
        domain: r.domain,
        title: r.title,
        excerpt: r.excerpt,
        articleText: r.articleText,
        heroImage: image ?? r.heroImage,
        tint: r.tint,
        stripe: r.stripe,
        initial: r.initial,
        contentType: r.contentType,
        readingTimeMinutes: r.readingTimeMinutes,
        size: r.size,
        // A whole-collection copy keeps the owner's arrangement; a single save is just new.
        position: wanted ? 0 : r.position,
        // Nothing would ever finish a crawl started in someone else's library.
        status: "ready" as const,
        productData: r.productData,
        templateData: r.templateData,
        // A copy of a link still waiting for its AI step is waiting too.
        aiPending: r.aiPending,
        source: "shared",
      };
    })
  );
  if (copies.length === 0) return { links: [], collection };

  const inserted = await db.insert(schema.links).values(copies).returning();
  const prices = rows.flatMap((r, i) => {
    const p = shared.latest.get(r.id);
    return p ? [{ linkId: copies[i].id, price: p.price, currency: p.currency, inStock: p.inStock }] : [];
  });
  const snapshots = prices.length ? await db.insert(schema.priceSnapshots).values(prices).returning() : [];
  const latest = new Map(snapshots.map((p) => [p.linkId, p]));

  return {
    collection,
    links: inserted.map((row) => {
      const p = latest.get(row.id);
      return toLinkItem(row, {
        latest: p,
        history: p ? [{ date: p.capturedAt.toISOString().slice(0, 10), price: Number(p.price) }] : [],
      });
    }),
  };
}

/** Housekeeping for the collections that pile up after a reorganisation. */
export async function deleteEmptyCollections(): Promise<string[]> {
  const uid = await currentUserId();
  const nonEmpty = await db
    .selectDistinct({ collectionId: schema.links.collectionId })
    .from(schema.links)
    .where(and(eq(schema.links.userId, uid), isNull(schema.links.deletedAt)));
  const keep = nonEmpty.map((r) => r.collectionId);

  const deleted = await db
    .delete(schema.collections)
    .where(
      and(
        eq(schema.collections.userId, uid),
        eq(schema.collections.isSmart, false),
        eq(schema.collections.isInbox, false),
        keep.length > 0 ? notInArray(schema.collections.id, keep) : sql`true`
      )
    )
    .returning({ id: schema.collections.id });
  return deleted.map((c) => c.id);
}

export async function addHighlight(linkId: string, quote: string) {
  const uid = await currentUserId();
  if ((await ownedLinkIds(uid, [linkId])).length === 0) return;
  await db.insert(schema.highlights).values({ linkId, userId: uid, quote });
}

export async function setAlertThreshold(linkId: string, threshold: number, currency: string) {
  const uid = await currentUserId();
  if (!isPro(await currentPlan())) return PRO_REQUIRED;
  if ((await ownedLinkIds(uid, [linkId])).length === 0) return;
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
  const uid = await currentUserId();
  if (items.length === 0) return { links: [], skipped: 0 };

  const collectionId = await ensureInbox();

  // No unique index on (user_id, url): duplicates are a thing this app deliberately
  // surfaces (`is:duplicate`), so the import filters rather than the database.
  const existing = await db
    .select({ url: schema.links.url })
    .from(schema.links)
    .where(eq(schema.links.userId, uid));
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
      userId: uid,
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

/** The most links one `uploadLibrary` call takes. */
const UPLOAD_BATCH = 200;

/** A collection of an iOS local library, as `uploadLibrary` takes it. */
export type UploadedCollection = Pick<
  Collection,
  "id" | "name" | "color" | "icon" | "isSmart" | "smartQuery" | "isInbox" | "reasoning" | "createdBy"
>;
/** A link of an iOS local library: its `LinkItem`, plus an image item's picture in base64. */
export type UploadedLink = LinkItem & { image?: string };

/** The upgrade (CONTEXT.md): an iOS local library moves into this account's server library, up to UPLOAD_BATCH links a
 * call and every collection each time. Collections match by name (`matchCollection`), links by the id they had on the
 * phone or by URL (`linkMatcher`), and a match merges (`mergeLinks`). Anything new goes in as the phone had it, keyed by
 * that id (`client_id`) and waiting for its AI step (`enrichLink`), so sending the same links again creates nothing. An
 * image item's picture comes along in base64, like `createImage`'s. Pro only. */
export async function uploadLibrary(upload: { collections: UploadedCollection[]; links: UploadedLink[] }) {
  const uid = await currentUserId();
  if (!isPro(await currentPlan())) return PRO_REQUIRED;
  if (!Array.isArray(upload?.links) || upload.links.length > UPLOAD_BATCH) {
    const t = await getT();
    throw new Error(t("Send up to {count} links at a time.", { count: UPLOAD_BATCH }));
  }
  const items = upload.links.map(cleanUploadedLink);
  const inboxId = await ensureInbox();

  // The phone's collection ids → this library's. A link in a collection that didn't come along goes to the inbox.
  const owned = await db.select().from(schema.collections).where(eq(schema.collections.userId, uid));
  const collectionIds = new Map<string, string>();
  for (const c of (Array.isArray(upload.collections) ? upload.collections : []).map(cleanUploadedCollection)) {
    if (!c) continue;
    let id = c.isInbox ? inboxId : matchCollection(c, owned)?.id;
    if (!id) {
      const [made] = await db
        .insert(schema.collections)
        .values({
          userId: uid,
          name: c.name,
          color: c.color,
          icon: c.icon ?? null,
          isSmart: Boolean(c.isSmart),
          smartQuery: c.smartQuery ?? null,
          reasoning: c.reasoning ?? null,
          createdBy: c.createdBy ?? "user",
        })
        .returning();
      owned.push(made);
      id = made.id;
    }
    collectionIds.set(c.id, id);
  }

  // Each row this upload touches, with its copies from the phone. Rows it creates get their ids up front, so a second
  // copy of one page in the same upload joins the first.
  const matcher = linkMatcher(
    await db
      .select({ id: schema.links.id, url: schema.links.url, clientId: schema.links.clientId, contentType: schema.links.contentType })
      .from(schema.links)
      .where(eq(schema.links.userId, uid))
  );
  const copies = new Map<string, UploadedLink[]>();
  const fresh = new Set<string>();
  for (const item of items) {
    let id = matcher.match(item);
    if (!id) {
      id = randomUUID();
      fresh.add(id);
      matcher.add(id, item);
    }
    copies.set(id, [...(copies.get(id) ?? []), item]);
  }

  const matchedIds = [...copies.keys()].filter((id) => !fresh.has(id));
  const [existing, quotes, [{ pinned }]] = await Promise.all([
    matchedIds.length ? db.select().from(schema.links).where(inArray(schema.links.id, matchedIds)) : [],
    matchedIds.length
      ? db
          .select({ linkId: schema.highlights.linkId, quote: schema.highlights.quote })
          .from(schema.highlights)
          .where(inArray(schema.highlights.linkId, matchedIds))
      : [],
    db
      .select({ pinned: sql<number>`count(*)::int` })
      .from(schema.links)
      .where(and(eq(schema.links.userId, uid), eq(schema.links.pinned, true), isNull(schema.links.deletedAt), isNull(schema.links.archivedAt))),
  ]);
  const rows = new Map(existing.map((r) => [r.id, r]));
  // The pin limit holds across the merge too: two live pinned links.
  let pinSlots = Math.max(0, 2 - pinned);

  const now = new Date();
  const inserts: (typeof schema.links.$inferInsert)[] = [];
  const updates: Promise<unknown>[] = [];
  const tagged: { linkId: string; name: string }[] = [];
  const highlights: (typeof schema.highlights.$inferInsert)[] = [];
  const images: { id: string; base64: string; created: boolean }[] = [];
  for (const [id, [first, ...rest]] of copies) {
    const row = rows.get(id);
    const known = new Set(quotes.filter((q) => q.linkId === id).map((q) => q.quote));
    // A row already here keeps everything but what merging adds; its tags join below whatever they are.
    const merged: MergeFields = row
      ? [first, ...rest].reduce((m, c) => mergeLinks(m, c), {
          tags: [],
          highlights: [...known].map((quote) => ({ quote })),
          note: row.note,
          createdAt: row.createdAt.toISOString(),
          pinned: row.pinned,
          favorite: row.favorite,
        } as MergeFields)
      : rest.reduce((m, c) => mergeLinks(m, c), first);
    const live = row ? !row.deletedAt && !row.archivedAt : !first.deleted && !first.archived;
    if (merged.pinned && !row?.pinned) {
      if (live && pinSlots > 0) pinSlots -= 1;
      else merged.pinned = false;
    }

    for (const h of merged.highlights ?? []) {
      if (!known.has(h.quote)) highlights.push({ linkId: id, userId: uid, quote: h.quote, note: h.note ?? null });
    }
    for (const name of merged.tags) tagged.push({ linkId: id, name });
    const picture = [first, ...rest].find((c) => c.image)?.image;
    if (first.contentType === "image" && picture && !row?.url) images.push({ id, base64: picture, created: !row });

    const fields = { note: merged.note || null, createdAt: new Date(merged.createdAt), pinned: Boolean(merged.pinned), favorite: Boolean(merged.favorite) };
    if (row) {
      if (
        fields.note !== row.note ||
        fields.createdAt.getTime() !== row.createdAt.getTime() ||
        fields.pinned !== row.pinned ||
        fields.favorite !== row.favorite
      ) {
        updates.push(db.update(schema.links).set({ ...fields, updatedAt: now }).where(eq(schema.links.id, id)));
      }
      continue;
    }
    const page = first.contentType !== "note" && first.contentType !== "image";
    inserts.push({
      ...fields,
      id,
      userId: uid,
      clientId: first.id,
      collectionId: collectionIds.get(first.collectionId) ?? inboxId,
      url: page ? cleanUrl(first.url) : first.url,
      domain: first.domain,
      title: first.title,
      excerpt: first.excerpt,
      articleText: first.articleText ?? null,
      heroImage: first.heroImage ?? null,
      tint: first.tint,
      stripe: first.stripe,
      initial: first.initial,
      contentType: first.contentType,
      readingTimeMinutes: first.readingTimeMinutes ?? null,
      size: first.size,
      // Nothing here would finish a read the phone hadn't: enrichLink reads the page when Pro opens it.
      status: "ready",
      productData: productJson(first.product),
      templateData: first.templateData ?? null,
      source: first.source,
      importMeta: first.importMeta ?? null,
      httpStatus: first.httpStatus ?? null,
      archivedAt: first.archived ? now : null,
      deletedAt: first.deleted ? now : null,
      aiPending: page && first.url !== "",
    });
  }

  if (inserts.length) await db.insert(schema.links).values(inserts);
  await Promise.all(updates);
  const names = [...new Set(tagged.map((t) => t.name))];
  if (names.length) {
    const tagRows = await db
      .insert(schema.tags)
      .values(names.map((name) => ({ userId: uid, name })))
      .onConflictDoUpdate({ target: [schema.tags.userId, schema.tags.name], set: { name: sql`excluded.name` } })
      .returning({ id: schema.tags.id, name: schema.tags.name });
    const tagIds = new Map(tagRows.map((t) => [t.name, t.id]));
    await db
      .insert(schema.linkTags)
      .values(tagged.map((t) => ({ linkId: t.linkId, tagId: tagIds.get(t.name)! })))
      .onConflictDoNothing();
  }
  if (highlights.length) await db.insert(schema.highlights).values(highlights);
  await Promise.all([...fresh].map((id) => savePrice(id, copies.get(id)![0].product)));
  for (const { id, base64, created } of images) {
    try {
      const url = await uploadImage(Buffer.from(base64.replace(/^data:[^,]*,/, ""), "base64"), id);
      await db.update(schema.links).set({ url, heroImage: url }).where(eq(schema.links.id, id));
    } catch (err) {
      // No half-saved card: the next upload of it starts this one again.
      if (created) await db.delete(schema.links).where(eq(schema.links.id, id));
      throw err;
    }
  }
  return { ok: true as const, created: fresh.size, merged: matchedIds.length };
}

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const object = <T>(v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : undefined);

/** A phone's link, typed field by field: a bad value can't fail the insert or the library that reads it later. */
function cleanUploadedLink(raw: unknown): UploadedLink {
  const l = object<Partial<Record<keyof UploadedLink, unknown>>>(raw) ?? {};
  if (typeof l.id !== "string" || !l.id || l.id.length > 100) throw new Error("Every uploaded link needs its id.");
  const created = new Date(text(l.createdAt, 40));
  const type = schema.contentTypeEnum.enumValues.find((t) => t === l.contentType) ?? "article";
  const product = object<ProductDetails>(l.product);
  return {
    id: l.id,
    url: text(l.url, 8_000),
    domain: text(l.domain, 500),
    title: text(l.title, 2_000).trim() || (type === "image" ? "Image" : "Untitled"),
    excerpt: text(l.excerpt, 100_000),
    articleText: Array.isArray(l.articleText) ? l.articleText.filter((p) => typeof p === "string") : undefined,
    heroImage: text(l.heroImage, 8_000) || undefined,
    tint: text(l.tint, 20) || "#9aa3ad",
    stripe: text(l.stripe, 20) || "#ffffff",
    initial: text(l.initial, 8) || "?",
    contentType: type,
    readingTimeMinutes: Number.isInteger(l.readingTimeMinutes) ? (l.readingTimeMinutes as number) : undefined,
    collectionId: text(l.collectionId, 100),
    tags: Array.isArray(l.tags)
      ? [...new Set(l.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "").map((t) => t.trim().slice(0, 100)))]
      : [],
    size: CARD_SIZES.find((s) => s === l.size) ?? "M",
    status: "ready",
    createdAt: Number.isNaN(created.getTime()) ? new Date().toISOString() : created.toISOString(),
    source: text(l.source, 40) || "ios",
    importMeta: object<ImportMeta>(l.importMeta),
    note: text(l.note, MAX_NOTE_CHARS).trim() || undefined,
    favorite: l.favorite === true,
    pinned: l.pinned === true,
    httpStatus: Number.isInteger(l.httpStatus) ? (l.httpStatus as number) : undefined,
    archived: l.archived === true,
    deleted: l.deleted === true,
    highlights: Array.isArray(l.highlights)
      ? l.highlights.flatMap((h) => {
          const quote = text(object<{ quote?: unknown }>(h)?.quote, 20_000);
          const note = text(object<{ note?: unknown }>(h)?.note, MAX_NOTE_CHARS);
          return quote ? [{ id: "", quote, note: note || undefined }] : [];
        })
      : [],
    // The price becomes a snapshot row, which needs a number and a currency.
    product: product && {
      ...product,
      price: Number.isFinite(product.price) ? product.price : undefined,
      currency: text(product.currency, 10) || "$",
    },
    templateData: object<TemplateData>(l.templateData),
    image: text(l.image, 40_000_000) || undefined,
  };
}

function cleanUploadedCollection(raw: unknown): UploadedCollection | null {
  const c = object<Partial<Record<keyof UploadedCollection, unknown>>>(raw);
  const name = text(c?.name, 200).trim();
  if (!c || typeof c.id !== "string" || !name) return null;
  const icon = text(c.icon, 40);
  return {
    id: c.id,
    name,
    color: text(c.color, 20) || "#9aa3ad",
    icon: icon && [...icon].length <= 8 ? icon : undefined,
    isSmart: c.isSmart === true,
    smartQuery: text(c.smartQuery, 2_000) || undefined,
    isInbox: c.isInbox === true,
    reasoning: text(c.reasoning, 2_000) || undefined,
    createdBy: c.createdBy === "system" ? "system" : "user",
  };
}

export type GroupedResult = { collection: Collection; linkIds: string[]; reasoning: string };

/** The onboarding payoff: everything sitting unsorted gets read against what the user
 * said matters and comes back as a few named collections. Dead links are left out —
 * they've already been checked by this point and nobody wants them ranked. Free and Pro
 * alike: import grouping keeps its AI pass for everyone, and GROUP_LIMIT caps the cost. */
export async function groupInbox(priorities: Priorities): Promise<GroupedResult[]> {
  const uid = await currentUserId();
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
        eq(schema.links.userId, uid),
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
        userId: uid,
        name: group.name,
        color: SYSTEM_COLORS[i % SYSTEM_COLORS.length],
        reasoning: group.reasoning,
        createdBy: "system",
      })
      .returning();

    await db
      .update(schema.links)
      .set({ collectionId: row.id, updatedAt: new Date() })
      .where(and(inArray(schema.links.id, linkIds), eq(schema.links.userId, uid)));

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
  const uid = await currentUserId();
  // A bulk move is one signal per link, not one per gesture — whatever reads this later
  // wants to know about the links, and reconstructing them from a payload is worse.
  const targets = linkIds?.length ? linkIds : [linkId ?? null];
  await db.insert(schema.userSignals).values(
    targets.map((id) => ({
      userId: uid,
      linkId: id,
      collectionId: collectionId ?? null,
      action,
      payload: (payload ?? null) as object | null,
    }))
  );
}

/** App Store 5.1.1(v): an account made in the app can be deleted from it. Every library
 * table cascades from users; the stored images and the auth user go explicitly. */
export async function deleteAccount() {
  const uid = await currentUserId();
  const rows = await db.select({ id: schema.links.id }).from(schema.links).where(eq(schema.links.userId, uid));
  await db.delete(schema.users).where(eq(schema.users.id, uid));
  if (rows.length) await supabaseAdmin.storage.from(HERO_IMAGES_BUCKET).remove(rows.map((r) => `${r.id}.webp`));
  const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (error) throw new Error(error.message);
}
