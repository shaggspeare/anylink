# Claude Code task: plan the AnyLink implementation

You are planning — not yet writing — the implementation of **AnyLink**, a link-storage web app.
Deliver a written implementation plan first; do not start coding until the plan is reviewed.

## Inputs in this bundle
- `design/AnyLink.dc.html` — all designed screens (a canvas of options, ids 1a…4e). **Design reference only.** It is a self-contained HTML prototype; do not ship or port its markup. Recreate the screens in the target codebase's real stack and patterns.
- `design/AnyLink Design Tokens.dc.html` — the token sheet (colour, ink alpha, type scale, radii, glass recipe, spacing, elevation). Treat these values as authoritative.
- `design/ios-frame.jsx`, `design/support.js` — prototype scaffolding for the mockups. Ignore for production.
- `README.md` — screen-by-screen spec, tokens, interactions, state.

Fidelity: **high**. Colours, type, spacing and radii in the mockups and token sheet are final; match them.

## What AnyLink is
A personal library for saved links. The user pastes a URL (or shares/drops one, or uses the browser extension); the app crawls it, extracts title, excerpt, hero image, domain and suggested tags, and files it into a collection. The library is a resizable card mosaic (S/M/L per card). Product URLs are recognised and rendered as spec sheets with price tracking.

## Core features to plan
1. **Capture** — paste a URL, ⌘V anywhere, drag-and-drop a link or bookmarks export, browser extension, iOS share sheet. Clipboard suggestion card.
2. **Crawl + enrich** — fetch metadata (title, excerpt, hero, favicon, reading time, type: article / video / product), progress states, failure and paywall fallbacks, editable form before save with collection + card-size required.
3. **Library** — card mosaic with per-card S/M/L size persisted per link, drag-resize handle snapping to the grid, filters and sort, empty state.
4. **Collections** — CRUD, colour marker, counts, multi-select with bulk move / tag / archive / delete, smart collections saved from a search query.
5. **Search** — ⌘K palette over links, tags and collections, with match highlighting and keyboard nav (↑↓, ↵, ⌘↵ opens original).
6. **Link detail** — reader view (extracted article text, highlights) plus a metadata rail; product variant with spec table, price history, price alerts, and the same product saved from other retailers.
7. **Mobile web** — one-column library, sticky search, bottom tab bar, add-link sheet above the keyboard.
8. **Sync + auth** — account, single library synced across web/extension/mobile.

## Deliverable: the plan
Produce `PLAN.md` covering:
1. **Stack recommendation** — framework, styling approach that can express the glass/blur system, data layer, background job runner for crawling, storage for hero images. Justify each in 1–2 lines. If the repo already has a stack, adopt it and say what you're reusing.
2. **Data model** — tables/collections and fields for links, collections, tags, link_sizes, highlights, price_snapshots, users, crawl_jobs. Note indexes needed for search.
3. **Crawl pipeline** — queue, fetch, parse (readability + OpenGraph + JSON-LD for products), image storage/resizing, retry and timeout policy, what runs synchronously so the add form can show progress.
4. **Search design** — what powers it, how tags/collections/links are unified in one result set, latency target.
5. **Screen inventory** — each designed screen mapped to a route and the components it needs; call out shared components (card, glass panel, chips, collection marker, bulk bar, palette).
6. **Milestones** — 4–6 shippable slices, each independently demoable, starting with the thinnest end-to-end path (paste → crawl → card in library).
7. **Risks and open questions** — crawling sites that block bots, paywalled content, product-page parsing variance across retailers, price-check scheduling cost, image copyright/hotlinking, extension review timelines.
8. **What you would cut** — features that look cheap in the mockups but are expensive to build, with a recommendation.

## Constraints
- Match the token sheet exactly; the frosted-glass treatment (translucent white fills over blurred colour) is the product's identity — flag anywhere it would hurt performance or accessibility and propose a fallback.
- Keyboard-first: ⌘K, ⌘V, ↑↓/↵, shift-click ranges.
- Minimum hit target 44px on mobile; text contrast must hold over glass.
- No placeholder imagery in production — plan real hero image storage.

Ask me about anything ambiguous before writing code.
