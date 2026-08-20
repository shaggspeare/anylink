# AnyLink — Implementation Plan

Personal link library: paste a URL, crawl + enrich it, file it into a collection, show it as a resizable card. Reader view, product/PDP variant with price tracking, ⌘K search, multi-select collections, mobile web.

Decisions locked in before writing this plan (asked up front, per the brief):
- **Stack:** Next.js + Postgres, greenfield (no existing repo to adopt).
- **Auth scope for v1:** single user, no login screen.
- **Crawl engine:** self-hosted fetch + Readability/Cheerio, headless-browser fallback only when needed.
- **Product parsing:** generic (JSON-LD/OG) only — the Rozetka/UAH example in mockup 4e is a realistic placeholder, not a retailer to special-case.
- **Hosting/DB:** existing accounts — Vercel (Pro) + Supabase (free tier).

---

## 1. Stack recommendation

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router), TypeScript** | Server components + Route Handlers give one deployable for UI, API, and SSE crawl-progress streaming — no separate backend service to stand up. |
| Styling | **Tailwind CSS + a small `tokens.css`** | Tailwind's utility model maps cleanly onto the token sheet (spacing/radii/type scale as theme extensions); raw CSS custom properties hold the glass recipe (`--glass-fill-42/55/70`, blur/saturate) since `backdrop-filter` isn't a Tailwind first-class the way color/spacing are. |
| DB | **Supabase Postgres** (existing free-tier account) | Relational fits the link/collection/tag/price-history shape, and native full-text search (see §4) removes a whole search-infra decision. Free tier's 500MB DB and pooled connections are more than enough at personal-library scale. |
| ORM | **Drizzle** | Thin, SQL-shaped, easy to hand-write the `tsvector`/GIN index migrations FTS needs, and connects to Supabase over plain Postgres — no vendor SDK lock-in. |
| Image storage | **Supabase Storage** (same account, not a new service) | Already provisioned; free tier gives 1GB + a CDN in front of it, which is enough for hero-image thumbnails at personal scale. Swap for R2/S3 later only if storage/egress actually becomes a cost problem. |
| Background/scheduled work | **Inline (in-request SSE stream) for crawl, Vercel Cron for price checks** | Crawls are single-digit seconds and need to *stream progress back into the add-link form* (mockup 3b) — a real queue adds latency and infra for no benefit at personal-library scale. Price checks are twice-daily and stateless — cron hitting an API route is the native platform feature, not a job-runner dependency. Vercel Pro's longer function duration (vs. Hobby's 10s cap) is what makes holding a request open for the Playwright fallback path viable. *(Ceiling: if crawl volume grows past what one request can hold open, move to a real queue — Inngest or a DB-polled worker. Not needed for the milestones below.)* |
| Deploy | **Vercel (Pro, existing account)** | Matches the Next.js + Cron + Route Handler streaming choices above with zero extra ops; Pro tier's higher function-duration and cron-frequency limits remove the two ceilings Hobby would hit first. |

## 2. Data model

Postgres, Drizzle schema. All tables carry `user_id` now (cheapest point to add it — see §7 open questions on auth) even though v1 has exactly one seeded user and no login UI.

```
users            id, email, created_at
collections      id, user_id, name, color, is_smart, smart_query (nullable text), created_at, updated_at
                 idx: (user_id)
tags             id, user_id, name
                 unique idx: (user_id, name)
links            id, user_id, collection_id -> collections,
                 url, canonical_url, domain, title, excerpt, article_text,
                 hero_image_url, favicon_url,
                 content_type enum('article','video','product'),
                 reading_time_minutes, status enum('crawling','ready','failed'),
                 archived_at (nullable), created_at, updated_at,
                 search_vector tsvector generated (title, excerpt, article_text)
                 idx: (user_id), (collection_id), (domain), GIN(search_vector)
link_tags        link_id -> links, tag_id -> tags   (PK: link_id, tag_id)
link_sizes       link_id -> links (PK), size enum('S','M','L') default 'M', updated_at
                 -- 1:1 with links for v1. If per-view sizing (e.g. a link sized
                 -- differently inside a collection than in the library) is ever
                 -- needed, add a `context` column then — not built speculatively.
highlights       id, link_id -> links, user_id, quote_text, start_offset, end_offset,
                 note (nullable), color, created_at
                 idx: (link_id)
price_snapshots  id, link_id -> links, price, currency, in_stock, captured_at
                 idx: (link_id, captured_at)
price_alerts     id, link_id -> links, threshold_price, currency, active, created_at
crawl_jobs       id, link_id -> links, user_id, url,
                 status enum('queued','running','succeeded','failed'),
                 error_message, attempts, started_at, finished_at, created_at
```

Search indexes: GIN on `links.search_vector`; btree on `tags.name` and `collections.name` (both already small per-user sets, no FTS needed on them — see §4).

## 3. Crawl pipeline

1. **Submit** — `POST /api/links` with the URL creates a `links` row (`status='crawling'`) and a `crawl_jobs` row, then opens a streamed response (SSE via a Route Handler `ReadableStream`) the add-link form (3b) reads directly. No queue — the request stays open for the ~3–8s the crawl takes, matches the mockup's live 4-step progress bar exactly.
2. **Fetch** — plain `fetch()`, realistic UA, 10s timeout, ≤5 redirects. If the response is a 403/429, or the body looks like a JS-shell (near-empty extracted text), fall back to a single shared **Playwright** instance (hard concurrency cap, 20s timeout) — kept as the exception path, not the default, to bound cost.
3. **Parse** — Cheerio for DOM + OpenGraph/meta tags (title, hero, favicon), **Mozilla Readability** for article body/excerpt/reading time, **JSON-LD** (`@type` `Article`/`Product`/`VideoObject`) for structured fields and `content_type` detection (video domains like youtube.com/vimeo.com as a secondary heuristic).
4. **Images** — hero image downloaded server-side (avoids hotlinking + client CORS), resized to a card-thumb size and a detail-hero size via `sharp`, uploaded to Supabase Storage; only stored on successful parse.
5. **Progress events** emitted per phase (`fetch` → `parse` → `images` → `tags`) map 1:1 to the mockup's `crawlSteps` list and `crawlPct = (step+1)/4`.
6. **Retry/timeout** — one retry on transient network errors only; 403/paywall responses surface immediately as `failed`/"excerpt only" rather than retried (don't hammer sites that are actively blocking). `crawl_jobs.attempts` capped at 2.
7. **Paywall/failure fallback** — if Readability yields near-empty text but OG metadata exists, save what's there and mark the link "excerpt only"; the editable form (3b right pane) is always shown regardless of crawl outcome, so the user can fix or fill in gaps either way — this is the spec's built-in escape hatch, not extra work.
8. **Price checks** (product links only) — Vercel Cron, twice daily, iterates `links` where `content_type='product'`, re-runs the lightweight fetch+JSON-LD price extraction (no image work), inserts a `price_snapshots` row, compares against any active `price_alerts` row.

## 4. Search design

**Postgres full-text search** (`tsvector` + GIN, `pg_trgm` for fuzzy tag/collection name matching) — no external search service. At personal-library scale (hundreds to low-thousands of links per user) this comfortably clears the palette's latency bar without adding Elasticsearch/Meilisearch/Algolia as a dependency.

- ⌘K query fires three small parallel queries (`Promise.all`) — links (`ts_rank` over `search_vector`, `LIMIT 6`), tags (`ILIKE`/trigram, `LIMIT 4`), collections (same, `LIMIT 4`) — combined client-side into the mockup's grouped result sections. `<mark>` highlighting via `ts_headline` for links, plain substring-wrap for tags/collections.
- Debounce input ~120ms client-side; target **<150ms server round-trip** at p50 so the palette feels instant, matching the keyboard-first bar (↑↓/↵ nav has no room for perceptible lag).
- "Save as smart collection" just persists the current query string onto `collections.smart_query` (`is_smart=true`); re-running a smart collection re-executes the same three-way search server-side. No separate query-builder UI (see §8, cuts).

## 5. Screen inventory

| ID | Route | Key components |
|---|---|---|
| 2a Library | `/` | `Sidebar`, `LibraryHeader`, `CardMosaic`, `Card` (+`SizeSwitch`, `ResizeHandle`), `AmbientOrbs` |
| 3a/3b Add a link | overlay `<AddLinkFlow>` mounted from Library's Add button and from a global ⌘V listener; also reachable at `/add` for extension/share-sheet deep links | `UrlField`, `CrawlProgress`, `EditableLinkForm`, `LivePreviewCard` |
| 3c Landing | `/welcome` (logged-out/marketing) | reuses `CardMosaic` as static hero art |
| 4a Link detail / reader | `/links/[id]` | `ReaderPanel` (hero, article body, `Highlight`, pull-quote), `MetadataRail`, `Breadcrumb` |
| 4b ⌘K search | global `<CommandPalette>` (root layout, not a route) | `PaletteInput`, `ResultGroup`, `KeyboardHintFooter` |
| 4c Collection + multi-select | `/collections/[id]` | `CollectionHeader`, `CollectionMarker`, `FilterSortChips`, `CardMosaic` (selectable variant), `BulkActionBar` |
| 4d Mobile | same routes, responsive breakpoints | `BottomTabBar`, `AddLinkSheet` (mobile variant of `AddLinkFlow`), sticky mobile header |
| 4e Product detail | `/links/[id]` (variant when `content_type='product'`) | `ProductHeader`, `SpecTable`, `PriceHistoryChart`, `PriceAlertControl`, `VariantSwatches` |

**Shared components:** `GlassPanel` (base translucent surface — fill/border/blur from tokens), `Card`, `Chip`, `CollectionMarker`, `BulkActionBar`, `CommandPalette`, `AmbientOrbs`.

The mosaic itself (2a/4c) is a CSS Grid with `grid-auto-rows: 4px; grid-auto-flow: row dense`, each card spanning `{cols, rows}` computed from its S/M/L size — this is a direct, low-code port of the mockup's own grid mechanism, not a new masonry implementation. Resize-drag snap rule ports 1:1 too: width past `unit × 1.45` → L, else height `> 245px` → M, else S.

## 6. Milestones

1. **Thinnest end-to-end loop** — paste URL → crawl (fetch + Readability + OG only, no Playwright fallback yet) → editable form → save → card in a single-column mosaic (fixed M size, no resize yet). One seeded user, one default collection. This alone proves capture → enrich → store.
2. **Library + collections** — full mosaic (S/M/L switch + drag-resize + snap), collections CRUD with color markers, multi-select + bulk move/tag/archive/delete.
3. **Reader + product detail** — 4a reader view with highlights, 4e product detection + spec table + current price/stock (no history chart yet).
4. **Search** — ⌘K palette across links/tags/collections, smart collections.
5. **Price tracking + crawl hardening** — Cron price checks, `price_snapshots` history chart, alert thresholds, Playwright fallback for blocked crawls, paywall "excerpt only" UI.
6. **Mobile + more capture surfaces** — responsive mobile layer (4d), drag-and-drop, global ⌘V capture, bookmarks-file import. Extension/share-sheet stay behind the same `POST /api/links` ingest API but ship as thin native clients after this.

## 7. Risks and open questions

- **Bot-blocking** — Playwright fallback helps but won't beat every anti-bot vendor; the honest fallback is "crawl failed, edit manually," not an arms race.
- **Paywalls** — best-effort OG metadata only; UI should say "excerpt only" rather than imply a full read.
- **Product-page parsing variance** — generic JSON-LD/OG parsing (per the locked decision) will *not* reliably produce mockup 4e's "26 of 38 fields" — that's an aspirational best case when a site's structured data is rich (price/title/image/availability are reliable; full spec sheets are the exception). Worth setting that expectation now so it isn't read as a regression later.
- **Price-check cost** — twice-daily cron over a personal library's product-link count is trivial; would need batching only if this became multi-tenant at scale.
- **Image copyright/hotlinking** — server-side download + re-host (rather than hotlinking) sidesteps CORS/referrer issues but is still redistributing someone else's image; treat as personal fair-use caching (same posture as any read-it-later app), keep the bucket private/signed rather than public.
- **Extension/store review timelines** — Chrome Web Store and Apple review can take days to weeks; keeping them thin clients over the same ingest API (§6, milestone 6) keeps them off the critical path.
- **Glass/blur performance & accessibility** — the mockup already follows "never stack two glass layers," which is the main performance guard. Still needs: a `prefers-reduced-transparency` fallback (swap blurred fill for solid `--paper`), and a contrast audit of ink-alpha text (`.5`/`.45`) over the *busiest* orb position, not just flat paper — small meta text is the likely WCAG AA failure point.

## 8. What I'd cut

- **Retailer-specific product parsers** — already decided against; generic JSON-LD/OG only.
- **"Same product at other retailers" cross-linking (4e rail)** — needs cross-site product matching (fuzzy title/brand/model matching or a product-identity service); cut for v1, revisit only if price tracking proves valuable enough to justify it.
- **Full 38-field spec tables** — accept whatever structured data a site exposes; no per-field custom scraping.
- **Browser extension + iOS share sheet as native builds** — ship the ingest API first; real extension/app-store builds are a post-v1 stretch, not milestone-6-blocking.
- **Bookmarks-file import** — reuses the crawl pipeline as a batch job; low priority next to the core loop, fine to slip past milestone 6.
- **Price alert delivery (email/push)** — v1 surfaces the price delta in-app only; outbound notifications need a transactional email/push provider decision that shouldn't gate the core product.
- **Smart-collection query builder** — v1 smart collection = the raw search string, re-run verbatim. No visual query builder.
