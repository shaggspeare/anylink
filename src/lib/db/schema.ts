import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  primaryKey,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const contentTypeEnum = pgEnum("content_type", ["article", "video", "product"]);
export const linkStatusEnum = pgEnum("link_status", ["crawling", "ready", "failed"]);
export const cardSizeEnum = pgEnum("card_size", ["S", "M", "L"]);
export const crawlJobStatusEnum = pgEnum("crawl_job_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull(),
    isSmart: boolean("is_smart").notNull().default(false),
    smartQuery: text("smart_query"),
    // The inbox links land in when you save without picking a collection. Exactly one
    // per user, created on first library read — a flag rather than a reserved name so
    // renaming it doesn't quietly spawn a second one.
    isInbox: boolean("is_inbox").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collections_user_id_idx").on(t.userId)]
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_user_id_name_idx").on(t.userId, t.name)]
);

export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    canonicalUrl: text("canonical_url"),
    domain: text("domain").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    articleText: text("article_text").array(),
    heroImage: text("hero_image"),
    favicon: text("favicon"),
    tint: text("tint").notNull(),
    stripe: text("stripe").notNull(),
    initial: text("initial").notNull(),
    contentType: contentTypeEnum("content_type").notNull().default("article"),
    readingTimeMinutes: integer("reading_time_minutes"),
    status: linkStatusEnum("status").notNull().default("ready"),
    size: cardSizeEnum("size").notNull().default("M"),
    // Manual drag-and-drop order. 0 means "never dragged", and sorting falls back to
    // newest-first on ties, so a fresh library already reads in a sensible order.
    position: integer("position").notNull().default(0),
    // Sparse, retailer-specific fields (variants, specs, rating...) that don't earn a
    // normalized table given how much they vary per site — see PLAN.md's product-parsing
    // risk note. Price itself stays relational, in price_snapshots/price_alerts below.
    productData: jsonb("product_data"),
    note: text("note"),
    favorite: boolean("favorite").notNull().default(false),
    // Last link check: null = never checked, 0 = unreachable, otherwise the HTTP status.
    httpStatus: integer("http_status"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    // Trash. Rows stay put until purged so a mis-click is recoverable.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("links_user_id_idx").on(t.userId),
    index("links_collection_id_idx").on(t.collectionId),
    index("links_domain_idx").on(t.domain),
  ]
);

export const linkTags = pgTable(
  "link_tags",
  {
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.linkId, t.tagId] })]
);

export const highlights = pgTable(
  "highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quote: text("quote").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("highlights_link_id_idx").on(t.linkId)]
);

export const priceAlerts = pgTable("price_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkId: uuid("link_id")
    .notNull()
    .references(() => links.id, { onDelete: "cascade" })
    .unique(),
  thresholdPrice: numeric("threshold_price", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const priceSnapshots = pgTable(
  "price_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    linkId: uuid("link_id")
      .notNull()
      .references(() => links.id, { onDelete: "cascade" }),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    inStock: boolean("in_stock"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_snapshots_link_id_captured_at_idx").on(t.linkId, t.capturedAt)]
);

export const crawlJobs = pgTable("crawl_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  linkId: uuid("link_id").references(() => links.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  status: crawlJobStatusEnum("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  attempts: integer("attempts").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
