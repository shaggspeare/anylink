# AnyLink for iOS — Features, behaviour & native iOS capabilities

Companion to `01-design-tokens-and-visual-spec.md` (how things look). This document
covers **what the product does**: every feature in the current web app, its exact
rules and copy, and how each one maps to native iOS (SwiftUI, iOS 26+). It ends with
the backend contract, the known gaps, and a screen-and-state checklist to design
against.

Snapshot: web app at commit `804973f` (2026-10-02; Next.js + Supabase Postgres,
deployed on Vercel).

**Legend**: ✅ in the web app today · 🟡 partly there · ❌ not built ·
**P0** needed for an iOS v1 at parity · **P1** first native win · **P2** later.

---

## 1. The product

**AnyLink** is a personal library for saved links. *"Paste anything. We read the
rest."* You paste (or share, or import) a URL. AnyLink crawls the page and pulls the
title, a summary, a hero image, reading time, the content type (article, video,
product) and suggested tags. You get an editable card before saving. Links live in
**collections** and show as a visual card library. Product pages become spec sheets
with price tracking. One small **query language** powers search, filters and saved
views.

### 1.1 Principles the code follows (keep them in iOS)

1. **Capture never blocks.** A crawl that fails or gets blocked still opens the form,
   pre-filled with whatever can be guessed. Saving needs nothing but a collection, and
   that defaults to the inbox.
2. **Nothing is deleted outright.** Delete means Trash. Every delete shows an **Undo**
   toast. Deleting a collection moves its links to Trash.
3. **The user's edits beat the AI.** If you type in a field while the AI pass is still
   running, its result won't overwrite that field.
4. **Honest states.** "Excerpt only" and "the title is guessed from the link" are said
   out loud, not hidden.
5. **Dead means gone, not refused.** Only 404, 410, no answer, or a parked domain count
   as dead. A site that blocks bots is not dead.
6. **One query language everywhere.** Sidebar filters, search, smart collections and
   tag chips are all just query strings.

### 1.2 Voice

Short, plain, second person, a little dry. Explain consequences, never blame.
Examples from the app:

- "Nothing to read yet"
- "Reading the page…"
- "Crawled — check the details"
- "The site wouldn't give up the full page — this card is built from its metadata and
  written up by AI. Worth a glance before you save."
- "Links stay here until you delete them."
- "Each one says why it exists. Bin the ones that miss; those links go back to
  Unsorted and the choice is remembered."

---

## 2. Information architecture

### 2.1 Web routes → iOS screens

| Web | What it is | iOS |
|---|---|---|
| `/` | Marketing landing page | Not in the app (App Store page). Its "Save · Organise · Find" story can feed the first-run welcome. |
| `/start` | Onboarding: Import → Clean → Calibrate → Collections | **Onboarding flow**, a `fullScreenCover` on first launch and from "Import links" |
| `/app` (`?q=…`) | All links, optionally filtered by a query | **Links tab** root |
| `/collections/[id]` | One collection or smart collection, with multi-select | Pushed from the **Collections tab** |
| `/links/[id]` | Reader / product detail | Pushed detail screen |
| `/trash` | Trash | Pushed from the Collections tab |
| Overlay: Add a link | Capture flow | **Sheet** (+ the Share Extension) |
| Overlay: ⌘K palette | Search | **Search tab** (`Tab(role: .search)`) |
| Overlay: drawer | Collections, filters, tags | **Collections tab** (iPhone) / sidebar (iPad) |
| Overlay: action sheet | Per-link actions | Context menu + sheet |
| — | — | **New**: Sign in, Settings, Share Extension |

### 2.2 Proposed iOS navigation

```
iPhone
TabView (Liquid Glass; .tabBarMinimizeBehavior(.onScrollDown) mirrors the web's hide-on-scroll)
├─ Links          NavigationStack
│   └─ All links (tiles ⇄ rows, sort, active-filter chip) → Link detail
├─ Collections    NavigationStack
│   └─ Collections list (All links, Unsorted, collections, filters, custom filters,
│      suggested, tags, Trash, Import, housekeeping, Settings)
│        → Collection → Link detail
│        → Filter results (a query) → Link detail
│        → Trash
├─ Search         Tab(role: .search): .searchable with tokens → results → Link detail
└─ Add            not a tab: a signal-tinted glass "+" (toolbar, or tabViewBottomAccessory)
                  → Add sheet
Share Extension   → compact Add sheet

iPad
NavigationSplitView: sidebar (the collections list) · content (mosaic S/M/L) · detail pushed
```

---

## 3. Data model

Swift mirrors of `src/lib/types.ts`. Note: Swift already has a `Collection` protocol,
so the type is named **`LinkCollection`**.

```swift
enum CardSize: String, Codable, CaseIterable { case S, M, L }           // default M
enum ContentType: String, Codable { case article, video, product }      // default article
enum LinkStatus: String, Codable { case crawling, ready, failed }

struct Highlight: Codable, Identifiable, Hashable { let id: String; var quote: String; var note: String? }
struct PriceSnapshot: Codable, Hashable { let date: String; let price: Double }   // date "YYYY-MM-DD"
struct Variant: Codable, Hashable { let label: String; let swatch: String }       // swatch = CSS colour
struct Spec: Codable, Hashable { let label: String; let value: String }

struct ProductDetails: Codable, Hashable {
    var retailer: String              // the domain, e.g. "rozetka.com.ua"
    var retailerInitial: String
    var retailerColor: String         // hex
    var code: String?
    var price: Double?                // latest snapshot
    var previousPrice: Double?        // ⚠ never filled by the server today (see §7)
    var currency: String              // symbol or ISO code; "$" when unknown
    var inStock: Bool?
    var delivery: String?
    var rating: Double?
    var reviewCount: Int?
    var warranty: String?
    var variants: [Variant]
    var specs: [Spec]
    var totalSpecCount: Int
    var priceHistory: [PriceSnapshot] // oldest first
    var alertThreshold: Double?
}

struct ImportMeta: Codable, Hashable {
    var folder: String?               // "Bookmarks bar / Reading / Rust"
    var savedAt: String?              // when the user saved it, per the export file
    var context: String?              // the Telegram message text
}

struct LinkItem: Codable, Identifiable, Hashable {
    let id: String
    var url: String                   // tracking params stripped, canonical when known
    var domain: String                // no "www."
    var title: String
    var excerpt: String
    var articleText: [String]?        // one string per paragraph / list item / heading
    var heroImage: String?            // public WebP, ≤1600 wide, once re-hosted
    var tint: String; var stripe: String; var initial: String   // card identity
    var contentType: ContentType
    var readingTimeMinutes: Int?      // articles only, 225 wpm
    var collectionId: String          // exactly one collection per link
    var tags: [String]
    var size: CardSize
    var position: Int?                // manual order; 0 = never dragged
    var status: LinkStatus
    var createdAt: String             // ISO 8601; the date it was saved (imports keep the original date)
    var source: String?               // "manual" | "chrome" | "telegram"
    var importMeta: ImportMeta?
    var note: String?
    var favorite: Bool?
    var httpStatus: Int?              // nil = never checked · 0 = no answer · 1 = parked · else HTTP status
    var archived: Bool?
    var deleted: Bool?                // true = in Trash
    var highlights: [Highlight]?
    var product: ProductDetails?      // only when contentType == .product
}

struct LinkCollection: Codable, Identifiable, Hashable {
    let id: String
    var name: String
    var color: String                 // hex
    var isSmart: Bool?                // a saved query ("custom filter"), holds no links
    var smartQuery: String?
    var isInbox: Bool?                // "Unsorted": exactly one, can't be deleted
    var reasoning: String?            // why the grouper made it (auto-made only)
    var createdBy: String?            // "user" | "system"
}
```

### 3.1 Rules

- Every link belongs to **exactly one** collection. There's no many-to-many.
- **Inbox ("Unsorted")** is created automatically, sorts first, uses `#9AA3AD`, and
  can't be deleted. New and imported links land here unless the user picks another
  collection.
- **Smart collections** ("custom filters") hold no links. Their contents are whatever
  `smartQuery` matches, re-run live. They're never a "Move to" target, colour
  `#7C8CFF`.
- **Archived** links are hidden from every view and count unless the query mentions
  `is:archived`.
- **Trash** (`deleted`) is kept apart from the library. Restore puts a link back;
  purge deletes the row and its stored image.
- **Duplicates are allowed** on purpose (`is:duplicate` surfaces them). The import
  skips URLs that are already in the library.
- **Tags** are free text, unique per user, a many-to-many with links.
- `user_signals` records accept/reject/move/keep/kill/calibrate actions. It's
  write-only (training data for later). iOS should send the same signals (§6.2).

---

## 4. Features

### 4.1 Capture ✅ (iOS share sheet ❌)

**Today**

- **Add a link** sheet from the ＋ FAB (phone), the Add button (desktop), or
  **⌘V anywhere** with a URL on the clipboard (outside text fields). ⌘V opens the
  sheet pre-filled and starts the crawl immediately.
- In the sheet: URL field (placeholder `https://`), **Paste** (reads the clipboard
  into the field) and **Fetch**. Enter also fetches. Only `http(s)://…` without
  spaces is accepted; anything else is ignored silently.
- **Clipboard suggestion**: when the sheet opens empty, it reads the clipboard; if
  that's a URL, an "On your clipboard {url}" row appears. One tap crawls it.
- **Drag and drop** a URL onto the drop zone (desktop).
- **Android/desktop PWA share target**: sharing a page to the installed web app opens
  the sheet pre-filled. iOS Safari doesn't support Web Share Target, so on iPhone
  this path doesn't exist yet.
- Mockup 4d (light, phone) shows the designed idle screen: eyebrow "New link" with an
  orange dot, the 32 pt hero "Paste anything. / We read the rest.", the line
  "Articles, videos, repos, recipes — AnyLink pulls the title, image and domain.", a
  52 pt URL field with a round ink → button, an "In your clipboard" card with a lime
  **Save** button, and a dashed card "**Share sheet works too** — Send any page to
  AnyLink from Safari — it lands in Reading by default." (The shipped default is
  Unsorted.)

**iOS**

| Need | Native API | Pri |
|---|---|---|
| Share from Safari or any app | **Share Extension** (`NSExtensionActivationSupportsWebURLWithMaxCount = 1`, plus text that contains a URL). A compact version of the Add sheet: crawl progress → title / collection / tags → Save. Auth token through a shared Keychain access group / App Group. | **P0** |
| Clipboard suggestion without the "Allow Paste" alert | `UIPasteboard.general.detectPatterns(for: [.probableWebURL])` shows "Link on your clipboard" without reading the value. A **`PasteButton(payloadType: URL.self)`** then reads it with no alert. Never read `UIPasteboard.general.url` on launch: since iOS 16 that triggers the system alert. | **P0** |
| ⌘V on an iPad hardware keyboard | Handle the responder `paste(_:)` action (user-initiated, no alert) → open the sheet pre-filled | P1 |
| Drag a URL in (iPad Split View / Stage Manager) | `.dropDestination(for: URL.self)` on the library → Add sheet pre-filled | P1 |
| Siri / Shortcuts / Action button | **App Intents**: `SaveLinkIntent(url:collection:)` that saves without UI, inbox by default; `AppShortcutsProvider` phrase "Save to AnyLink" | P1 |
| Control Center / Lock Screen | `ControlWidget` button "Save clipboard link" → opens the app to the Add sheet | P2 |
| Deep links | `anylink://add?url=…`, plus universal links `https://<web domain>/links/{id}` → detail | P1 |
| Safari Web Extension | Same ingest API; toolbar button "Save to AnyLink" | P2 |

### 4.2 Crawl & enrichment ✅ (server-side; iOS only streams it)

`POST /api/crawl {url}` streams **NDJSON** progress (§6.1). Pipeline:

1. **Fetch**: a plain HTTP fetch with a realistic browser user agent. If the site
   blocks it (403/429), returns a JS-only shell, or 404s a bot, it **retries in a
   headless browser**. In parallel it asks a third-party metadata service
   (microlink). The route has 60 s in total.
2. **Parse**: OpenGraph/meta tags → title, description, hero (`og:image` →
   `twitter:image` → JSON-LD image). Mozilla **Readability** extracts the article
   body into blocks (paragraphs, list items, headings, code). **JSON-LD** gives the
   type (Product → product; VideoObject, `og:type=video*`, or YouTube/Vimeo →
   video). Products also get price, currency, availability and rating.
   `rel=canonical` collapses URL variants. Reading time = words ÷ 225.
3. **Preview**: the parsed card is sent right away, and the form opens on it.
4. **AI pass** (skipped if more than 45 s have gone by): a model cleans the title,
   writes a real 1–2 sentence summary, confirms the type, picks up to 3 tags, and
   fills product price/currency/stock when it can tell. The form shows
   "Refining title, summary and tags…" and fields update unless the user already
   edited them.
5. **Degrade, don't fail**: if the page refused, the card is built from microlink →
   whatever the block page carried → the URL alone ("excerpt only"). A real dead page
   (404 everywhere, DNS failure) comes back as **failed**, with a title guessed from
   the URL slug ("…/apple-macbook-air-m4/p123456/" → "Apple macbook air m4").
6. **On save**: tracking parameters are stripped (`utm_*`, `fbclid`, `gclid`,
   `gbraid`, `wbraid`, `msclkid`, `yclid`, `ttclid`, `igshid`, `mc_cid`, `mc_eid`,
   `_openstat`, `ref_src`, `si`). The hero image is downloaded, resized (≤1600 px,
   WebP q82) and re-hosted **after** the response. The card shows the original image
   first and picks up the re-hosted one on the next load.

Failure reasons: `blocked`, `not-found`, `timeout`, `not-html`, `network`,
`invalid-url`.

**iOS**: stream with `URLSession.bytes(for:)` → `.lines` → decode each line (§6.1).
Map step events to the progress UI. Play a `.success` haptic when the form opens.
Crawling must stay on the server (the Share Extension has a tight memory limit, and
the headless browser can't run on device).

### 4.3 Save form ✅

| Field | Default | Rules |
|---|---|---|
| Title | crawled title (failed: guessed from URL) | Free text; empty → saved as the domain |
| Excerpt | crawled summary | Free text, auto-grows (min 86, max 192 pt) |
| Tags | pre-ticked crawler/AI tags | Lime pills, tap to remove. Field "Add a tag, then Enter". Suggestions = crawler tags + existing library tags that the title, excerpt or domain mention, max 8, shown as "+ tag" pills |
| Collection | **Unsorted** | Required. Smart collections aren't offered. Error on blur: "Pick a collection to save into." |
| Card size * | **M** | S / M / L segmented control |

Notices above the preview:

- Excerpt only: "The site wouldn't give up the full page — this card is built from its
  metadata and written up by AI. Worth a glance before you save."
- Failed: "The page wouldn't open ({reason}) — the title is guessed from the link.
  Edit it and save; nothing else is needed."

Status line under the preview: "Crawled — check the details" / "Filled in from the
link — check it". Button: **Save to library** → "Saving…". On phones the Save button
stays pinned to the bottom of the sheet.

**iOS**: a `Form`-like custom layout in the Add sheet. Tags as a flow layout
of capsules plus a text field with `.onSubmit`. Collection as a `Menu`/`Picker`. Size
as a segmented `Picker`; consider hiding it on iPhone, where every card renders the
same (it still syncs to iPad and the web). Pin Save with `.safeAreaInset(edge: .bottom)`.
Detents `[.large]`, and keep the sheet interactive while the keyboard is up.

### 4.4 Library (All links) ✅

- Title "All links". The count "{n} links" shows on wide layouts only.
- **Phone**: a 2-up tile grid, or **one-line rows** via the List/Grid tab in the tab bar
  (shown only here; the choice persists). **iPad / desktop**: the S/M/L mosaic
  (tokens §10).
- **Sort** (not persisted; resets to Newest): Newest first · Oldest first ·
  Title A–Z · Site A–Z · **My order**.
- **Drag to reorder** (touch: hold 300 ms, light haptic, auto-scroll at the edges).
  Dropping saves the visible order and switches the sort to "My order", so the
  arrangement doesn't snap back. ⚠ Positions are global per link, so reordering
  inside a filter also reshuffles the global order.
- **Filtered view**: any query (from a filter, a tag, "Show all matches") shows as an
  ink chip "{query} ✕" next to the title. Tap to clear.
- **Entrance animation**: cards spring in from mixed scales, staggered (tokens §11).
- **Empty library**: panel "Start with the links you already have" + "Import your
  browser bookmarks or your Telegram saved messages. Dead links get stripped out and
  the rest come back grouped by what you actually care about." + **Import my links**.
- **Desktop only**: "⌘V paste anywhere to add a link" hint strip under the mosaic, and
  "drag cards to arrange, corners to resize" next to the count.

**iOS**: `ScrollView` + `LazyVGrid` (2 flexible columns) for tiles; `List` for rows
(gets `.swipeActions` and `.onMove` for free). On iPad, a custom `Layout` for dense
S/M/L packing. `.refreshable` to re-sync. Sort as a toolbar `Menu` with a `Picker`.
The layout switch belongs in the toolbar (a two-segment control or a toggle button):
tabs are places, not settings. Tiles: `.draggable` /
`.dropDestination` for reorder; long press → `.contextMenu(menuItems:preview:)` (iOS
starts the drag automatically when the finger moves after the lift).

### 4.5 Per-link actions ✅

| Action | Where on the web | iOS |
|---|---|---|
| Open the link detail | Tap a card | Tap → push |
| **Open original** | Sheet; iPad "Open" pill on the card; detail header (wide); **pinned bottom button** in detail (phone) | `SFSafariViewController` (in-app, `entersReaderIfAvailable` optional) or `openURL` to the default browser. Make it a setting. |
| **Share…** | Sheet (where the browser supports it) | `ShareLink(item: url, subject: title)` |
| **Copy link** | Sheet → toast "Link copied" | `UIPasteboard.general.url = url` + toast/haptic |
| **Move to collection** | Sheet sub-list → toast "Moved to {name}"; detail ⋮ "Add to collection" | `Menu` inside the context menu / sheet |
| **Favorite / Unfavorite** | Sheet; iPad hover ★; detail header ★ | Context menu, leading swipe in rows, detail toolbar |
| **Move to Trash** | Sheet; iPad hover 🗑; bulk bar → toast + **Undo** | Context menu (destructive), trailing swipe |
| Size S / M / L | iPad hover switch, resize handle; Add form | iPad: context-menu `Picker`, pointer resize; iPhone: no visual effect |
| Select | Collection view (hover check, shift-click range) | Edit mode (§4.12) |

### 4.6 Collections ✅

- The list is ordered: **All links** (ink marker) → **Unsorted** (pinned) → user
  collections (drag to reorder) → "New collection" → "Import links". Each row shows a
  colour marker and a live count.
- **Create**: inline form, name + one of 5 swatches → **Add**.
- **Rename**: inline edit; Enter saves, Esc cancels. **Delete**: its links move to
  Trash (the tooltip says "Delete — {n} links move to Trash"). Unsorted can't be
  renamed or deleted from the UI.
- **Delete empty collections**: housekeeping row → "Removed {n}".
- **Collection page**: marker, name, "{n} links", the smart query as a mono chip,
  **reasoning** for auto-made collections ("why these belong together"), a row of tag
  chips (All + every tag in the collection, single-select), sort, the mosaic, and
  multi-select.
- Empty collection: "Nothing here yet — Paste a URL to save your first link into this
  collection."

**iOS**: a `List` with sections. `.onMove` for reorder (`EditButton`). Swipe actions:
Rename / Delete (confirm when it has links: "Delete '{name}'? Its {n} links move to
Trash."). "New collection" opens a small sheet with a name field and a swatch row.
Collection page: a horizontal `ScrollView` of chips under a large title.

### 4.7 Filters, custom filters, suggested collections, tags ✅

- **Filters** (built in, shown only when they match something): Favorites
  `is:favorite` · Articles `type:article` · Videos `type:video` · Products
  `type:product` · With a note `is:noted` · Untagged `is:untagged` · Duplicates
  `is:duplicate` · Broken links `is:broken` · Archived `is:archived`.
- **Custom filters**: any search saved with a name (⌘S in the palette → "Name this
  filter"). Listed apart from collections, draggable. Opening one shows its query chip.
- **Suggested collections**: any tag on **3 or more** non-archived links that isn't
  already a collection name or smart query. Top 4, title-cased, with **Create** (saves
  it as a smart collection `#tag`) and ✕ (dismiss, remembered on the device).
- **Tags**: a collapsed section, the top 12 by count, shown as `#tag` rows. Opening one
  filters All links by `#tag`.

**iOS**: sections in the Collections list. Filters push a results screen with the
query as the title. Suggested collections: a row with an inline "Create" button and a
swipe to dismiss. Tags: a `DisclosureGroup`.

### 4.8 Search & the query language ✅

**Search UI today**: placeholder "Search links, #tags…". Results update as you type,
grouped:

- **Links**: up to 6, title with the match highlighted, domain on the right. With an
  empty query this shows the 6 most recent links.
- "**Show all {n} matches** — in the library": when there are more than 6, opens All
  links filtered by the query.
- **Tags & collections**: up to 4 tags (`#tag`; tapping one turns the query into
  `#tag`) and up to 4 collections. An empty query shows the first 4 collections.
- "No matches."
- Keyboard: ↑↓ move, ↵ open, **⌘↵ open original**, **⌘S save as a custom filter**,
  Esc closes.

**Query language** (used by search, filters, smart collections and the library `?q=`):

| Syntax | Meaning |
|---|---|
| `word` | Case-insensitive substring of title, excerpt, domain, URL, note, tags **or full article text** |
| `"exact phrase"` | Phrase as one term |
| `#tag` | Has a tag **starting with** `tag` (prefix, so `#des` matches `design`) |
| `title:x` `excerpt:x` `note:x` `link:x` | Substring in that field (`link:` = domain + URL) |
| `type:article` / `video` / `product` | Content type |
| `is:favorite` `is:noted` `is:untagged` `is:duplicate` `is:broken` `is:archived` | Flags |
| `created:2026-01` | Saved on a date with that prefix (year, month or day) |
| `created:>2026-01-15` / `created:<2026-01` | After / before (string comparison) |
| `-term` | Exclude (works with any form: `-#work`, `-type:video`) |
| `match:or` | Positive terms match **any** instead of all; exclusions still apply |
| `field:"quoted value"` | Quoted value for any field |

Unknown prefixes (like a pasted `https://…`) are treated as plain text. Duplicates
compare URLs lowercased with the trailing slash removed. Broken = `httpStatus` is 0,
1, 404 or 410.

**iOS**: `Tab(role: .search)` + `.searchable(text:tokens:suggestedTokens:)`. Turn
recognised operators into **search tokens** (capsules such as "Videos", "#design",
"Favorites", "Not #work"). Offer `suggestedTokens` for types, flags and the top tags.
Results in a `List` with the Links / Tags / Collections sections and the match
highlighted with an `AttributedString` lime background. A "Save as filter" toolbar
button → alert with a name field. Run search **on device** over the synced library,
which is what the web does (all in memory). Index links into **Core Spotlight** too,
so they show up in system search (§5).

### 4.9 Link detail: reader ✅

- **Header**: Back (phone) or breadcrumb "Library › {collection}" (wide). Actions:
  **★ favorite**, **Note**, **Open original** (wide; pinned bottom button on phone),
  **⋮** with "Add to collection" (every other non-smart collection).
- **Hero**: 250 pt image (or the tint fallback) under a black gradient, with the domain
  (eyebrow) and title (28 pt, white) overlaid.
- **Body**: the extracted article as paragraphs (15 pt, line height 1.7, max 600 wide).
  If the extracted text has fewer than **40 words of real prose** (paragraphs of 8+
  words), the reader shows the excerpt instead. That stops app shells and nav labels
  from being shown as an article.
- **Video**: a placeholder instead of the body: "Video — open the original to watch.
  AnyLink stores the description and thumbnail only."
- **Rail** (below the article on phone): **Saved metadata** (Domain, Saved date,
  Reading time), **Tags** (chips, or "No tags yet."), **Also in your library** (up to
  3 other links from the same collection, "See all" → the collection; empty:
  "Nothing else here yet.").

**iOS**: `ScrollView` with a stretchy hero (`.scrollTransition` or a parallax header),
then text, then the rail. Video: inline thumbnail with a play button that opens the
original (or an embedded player for YouTube via `WKWebView`, P2). Toolbar:
favorite, note, `Menu` (Move to…, Share, Copy link, Trash). Bottom: a full-width
"Open original" glass button in `.safeAreaInset(edge: .bottom)`. Handoff:
`NSUserActivity` with the web URL of this link (P2).

### 4.10 Notes, favorites, highlights ✅ (partial)

- **Note**: one free-text note per link ("Why you saved this, what to do with it…"),
  saved when the field loses focus. Searchable with `note:`; filter "With a note".
- **Favorite**: a flag; ★ in signal on cards, rows and the detail screen; filter
  "Favorites".
- **Highlights** 🟡: select text in the reader → a **Highlight** pill → the quote is
  stored and shown with a lime background. There's no way to delete or annotate one,
  and no list of highlights (the `note` field on a highlight is unused).

**iOS**: note in a `TextEditor` sheet or inline section. Highlights need a
`UITextView` wrapper using `textView(_:editMenuForTextIn:suggestedActions:)` to add a
**Highlight** action to the system edit menu. SwiftUI `Text` selection can't add
custom actions. Proposed (P2): a highlights section in the rail with
swipe-to-delete.

### 4.11 Product detail & price tracking ✅ (partial)

- Header chip "Product detected". The open button reads "Open on {retailer}".
- **Top block**: product image, retailer badge + domain (+ "code {x}" when known),
  title, **price**, previous price struck through and "{−n}% since saved" (lime), status
  chips: In stock / Out of stock (green dot when in stock), delivery, "{rating} ★ ·
  {n} reviews", warranty. Variant swatches (first one ringed).
- **Specs**: "Specs AnyLink pulled". 8 rows, then "{shown} of {total} shown · show
  all / show less"; 1 column on phone, 2 on wide layouts.
- **Price history**: a line chart once there are **2+ snapshots**. Before that:
  "Checked twice daily — history will show up after the next check." A snapshot is
  recorded at save time, then by a server cron **every 12 hours**.
- **Alert me under** {currency} [number]: the threshold is saved when the field loses
  focus.

Real-world data (generic JSON-LD/OG parsing, no per-retailer scrapers): price,
currency, availability, rating and review count are usually there. **Variants, specs,
delivery, warranty and the product code are almost always empty**, and the previous
price is never filled. Design the minimal state first: image, title, price, stock,
rating, chart.

**iOS**: **Swift Charts**: `LineMark` + `PointMark` (periwinkle), plus a dashed
`RuleMark` at the alert threshold (new). The alert field is a `TextField` with
`.keyboardType(.decimalPad)` and the currency as a prefix. Price-drop alerts as
**push notifications** are ❌ (§7).

### 4.12 Multi-select & bulk actions ✅ (desktop-first)

- Collection pages only. Click the round check (hover) to select. Once anything is
  selected, a tap on a card toggles it; **shift-click selects a range**. Selected cards
  get a 2 pt ink ring and a lime ✓.
- **Bulk bar** (dark, floating): "{n} selected" · **Move to…** · **Tag** (a field
  that suggests existing tags) · **Archive** · **Delete** (confirm "Delete {n}
  links?", then a toast with Undo) · ✕ clear.
- On touch the hover check isn't reachable, so multi-select is effectively
  desktop-only on the web.

**iOS** (P0, done natively): an **Edit/Select** mode (toolbar "Select", or "Select" in
the context menu). Tap to toggle, and use the two-finger pan multi-select gesture
(`List(selection:)` supports it; the grid needs a custom version). The bottom toolbar
shows Move (`Menu`), Tag (alert with a text field and tag suggestions), Archive and
Delete (`.confirmationDialog`), and "{n} selected" as the title.

### 4.13 Archive, Trash, Undo ✅

- **Archive** (bulk only): hides links from every view. "Archived" in Filters shows
  them. There's **no Unarchive** action (§7).
- **Trash**: every delete path moves links here and shows the toast
  "Moved to Trash" / "{n} links moved to Trash" with **Undo** (5 s). The Trash screen
  shows "Links stay here until you delete them.", a list with **Restore** and
  **Delete** (forever, no confirm) per row, and **Empty trash** → "Delete them for
  good?" (second tap confirms). Empty state: "Nothing here. Deleted links land in Trash
  until you empty it." Deleting forever also removes the stored hero image.

**iOS**: an Undo toast (custom overlay above the tab bar), plus shake-to-undo through
`UndoManager` for free. Trash rows: swipe Restore (leading) / Delete (trailing,
destructive). "Empty Trash" in the toolbar → `.confirmationDialog`.

### 4.14 Link health ✅ (server)

- Each link can be checked with a ranged GET (8 s timeout). The first 16 KB is sniffed
  for parking-service markers. Stored as `httpStatus`: **0 = no answer**,
  **1 = parked**, otherwise the HTTP status.
- **Dead** = 0, 1, 404 or 410 only. 402/403/503 from bot walls are treated as alive.
- A **nightly cron** re-checks 200 links per run, never-checked and oldest-checked
  first, 24 at a time.
- Surfaced as the **Broken links** filter (`is:broken`) and in onboarding's Clean step.

**iOS**: read-only. Optional badge on broken cards (proposed: a small slate "Gone"
chip), and an `is:broken` token.

### 4.15 Import & onboarding (`/start`) ✅

Four steps with a progress rail (**Import · Clean · Calibrate · Collections**):

1. **Import**: "Bring your links" / "Point AnyLink at the links you already have.
   Nothing is uploaded anywhere except your own library." Drop or **Choose files…**
   (`.html`, `.htm`, `.json`, multiple):
   - **Browser bookmarks** (Netscape HTML format, the export from Chrome and every
     other browser): "Bookmark manager → Export bookmarks → an HTML file". The folder
     path and the date added are kept.
   - **Telegram** Saved Messages: "Saved Messages → ⋮ → Export chat history → JSON".
     The message text is kept as context.
   - Both at once are merged; the first occurrence of a URL wins. Max 5,000 links per
     import. Shows "{n} links found" + "{n} from bookmarks" / "{n} from Telegram" →
     **Import {n} links**. No crawl happens here, so it takes seconds. Links already in
     the library are skipped. Errors: "No links in that file. A Chrome bookmarks export
     or a Telegram result.json both work." / "Couldn't read that file — is it the
     export itself, rather than a zip of it?" / "The import didn't go through. Nothing
     was saved — try again."
2. **Clean**: "Checking what still exists". A live counter "{done}/{total}" with a lime
   bar, then the dead list ("gone" / "parked" / status code + title) → **Remove {n} dead
   links** (to Trash) or **Keep them for now**. If none: "Every link answered. Nothing
   to clean up." Resumable: the client keeps calling until nothing is left.
3. **Calibrate**: "What are you keeping links for?"
   - "What are you working on right now?" (free text)
   - "Which of these still interest you?" (chips built from their own folder names
     and most-saved domains)
   - "Keep or bin? ({n}/8)": 8 links sampled across domains, **Keep** (lime) /
     **Bin** (ink). Binned ones go to Trash.
   - "Anything you'd rather never see again?" (free text)
   - → **Build my collections**
4. **Collections**: "Building your collections — Reading every title against what you
   just told us. About twenty seconds." Then "{n} collections". Each card shows a
   marker, name, "{n} links", the **reasoning**, and **✓ keep** / **✕ bin** (bin puts
   its links back in Unsorted and deletes the collection) → **Open my library**.
   Without AI it falls back to grouping by folder, then domain.

**iOS**: a full-screen paged flow with a 4-segment progress header.
`.fileImporter(allowedContentTypes: [.html, .json], allowsMultipleSelection: true)`.
Most users will have these exports on a computer, so explain getting them via iCloud
Drive / Files / AirDrop. The parsers are pure functions and could run on device. The
Clean step can take minutes on a big library, so it's a candidate for a **Live
Activity** (P2). Keep/Bin works as swipeable cards (right = keep, left = bin) or the
two buttons.

### 4.16 Theme ✅

Light by default; a moon/sun toggle switches to dark and is remembered. Browser chrome
follows the canvas colour.

**iOS**: follow the **system appearance** by default, with an in-app override
(System / Light / Dark) in Settings via `.preferredColorScheme`.

### 4.17 Guided tour ✅

A 38-step spotlight tour (driver.js) that walks through the library, a collection, the
reader, a product page and Trash: saving, ⌘K search syntax, card controls, sizes,
sorting, collections, the inbox, filters, custom filters, suggested collections, tags,
import, clean-up, multi-select, highlights, notes, price history and alerts. Steps
whose element isn't on screen are skipped. Started from "Guided tour" in the drawer or
"See how it works" on the landing page.

**iOS**: **TipKit** popover tips anchored to the real controls, shown once in context:
"+ saves anything", "Long-press a card for actions", "Search takes filters like
`type:video`", "Collections suggest themselves". Replay from Settings.

### 4.18 Gestures & keyboard

| Web | iOS |
|---|---|
| Swipe right (not from an edge) opens the drawer; swipe left closes it, or opens Add a link when it's already closed | Not needed: Collections is a tab, and Add is one tap. Keep the system back-swipe free. |
| Tab bar hides on scroll down and returns on scroll up | `.tabBarMinimizeBehavior(.onScrollDown)` |
| Hold 300 ms to pick up a tile + haptic | Long press → context menu / drag (system) |
| Tap outside closes menus | System |
| ⌘K search · ⌘V capture · ↑↓ ↵ ⌘↵ · ⌘S save filter · Esc · shift-click range | iPad hardware keyboard: `.keyboardShortcut` for ⌘K (focus search), ⌘N (Add), ⌘F; `paste(_:)` for ⌘V; arrow keys with `.focusable` in results; ⌘↵ open original; ⌘S save filter; ⌘⌫ move to Trash; shift-click → `List` selection |

### 4.19 Accessibility already handled on the web (keep it)

- Reduce Transparency → solid surfaces. Reduce Motion → no entrance animation.
- Every phone control is 40–44 pt; the tile ⋯ has a 44 pt hit area around a 28 pt dot.
- Labels on icon-only controls ("Actions for {title}", "Add a link", "Close menu",
  "Remove from favorites"…). Reuse them as `accessibilityLabel`s.
- Image scrims in black so white text keeps contrast in both themes.
- Known risk: ink .45/.50 small text over the busiest orb area. Check contrast, and
  under **Increase Contrast** move those alphas one step up (.45 → .60).

iOS additions: Dynamic Type for every style (`relativeTo:`), VoiceOver rotor actions
on cards (Open original, Favorite, Move, Trash) through `.accessibilityActions`,
`.accessibilityElement(children: .combine)` on tiles (title, domain, favourite state).

---

## 5. Native iOS capability map

| Capability | API | Feature | Pri |
|---|---|---|---|
| Liquid Glass chrome | `TabView`, toolbars, `.glassEffect`, `GlassEffectContainer`, `.buttonStyle(.glassProminent)` | Tab bar, Add button, bulk toolbar | P0 |
| Tabs + search | `Tab`, `Tab(role: .search)`, `.searchable(tokens:)`, `.tabBarMinimizeBehavior(.onScrollDown)` | Navigation, search | P0 |
| Optional capture accessory | `.tabViewBottomAccessory { … }` ("Paste a link" capsule + clipboard state) | Capture | P1 |
| iPad layout | `NavigationSplitView`, custom `Layout` for the mosaic, `.hoverEffect`, pointer resize | Library, collections | P1 |
| Share Extension | `NSExtension` (share), App Group + Keychain sharing | Capture | **P0** |
| Paste without the alert | `PasteButton`, `UIPasteboard.detectPatterns`, responder `paste(_:)` | Capture | **P0** |
| In-app browser | `SFSafariViewController` | Open original | P0 |
| Share out | `ShareLink` | Per-link actions | P0 |
| Context menus & swipes | `.contextMenu(menuItems:preview:)`, `.swipeActions` | Per-link actions, Trash | P0 |
| Reorder / drag in & out | `.draggable`, `.dropDestination`, `List.onMove` | Library, collections | P1 |
| Multi-select | `EditMode`, `List(selection:)`, bottom toolbar | Bulk actions | P0 |
| Confirmations | `.confirmationDialog`, `.alert` with `TextField` | Delete, empty Trash, name a filter | P0 |
| Undo | toast + `UndoManager` (shake) | Trash, move | P0 |
| Haptics | `.sensoryFeedback(.impact(weight: .light) / .success / .selection)` | Pickup, save, size and sort change | P0 |
| Pull to refresh | `.refreshable` | Sync | P0 |
| Streaming crawl | `URLSession.bytes(for:).lines` | Capture | P0 |
| Charts | Swift Charts `LineMark`, `PointMark`, `RuleMark` | Price history | P1 |
| Text highlights | `UITextView` + `editMenuForTextIn` | Reader | P1 |
| File import | `.fileImporter` | Onboarding import | P1 |
| Contextual tips | TipKit | Tour | P1 |
| Offline cache | SwiftData (or a JSON cache) of the library | Everything; the web loads the whole library into memory | P1 |
| System search | Core Spotlight `CSSearchableIndex` (title, excerpt, domain, thumbnail) | Search | P1 |
| Siri / Shortcuts | App Intents: `SaveLinkIntent`, `OpenCollectionIntent`, `SearchLinksIntent`; `IndexedEntity` | Capture, search | P1 |
| Deep / universal links | `onOpenURL`, Associated Domains | Capture, sharing a link to a card | P1 |
| Widgets | WidgetKit: "Recently saved" (S/M), "Price watch" (M: product, price, change), Lock Screen "Unsorted {n}" | Library, products | P2 |
| Controls | `ControlWidget` "Save clipboard link" | Capture | P2 |
| Live Activity | ActivityKit for a long link check after import | Onboarding Clean | P2 |
| Push | APNs: price dropped under your alert | Price alerts (needs backend) | P2 |
| Handoff | `NSUserActivity` with the web URL | Detail | P2 |
| Background refresh | `BGAppRefreshTask` to keep the cache fresh | Sync | P2 |
| App icon | Icon Composer layered icon (Default / Dark / Clear / Tinted) | Brand | P1 |
| Sign in | Sign in with Apple (`AuthenticationServices`) + backend auth | Accounts (§6.3) | **P0** |

---

## 6. Backend contract for the iOS client

### 6.1 HTTP endpoints that exist today

**`POST /api/crawl`** — body `{"url": "https://…"}` → `400 {"error":"Invalid URL"}`
or a stream of `application/x-ndjson`, one JSON object per line:

```
{"type":"step","step":"fetch"}                 // also "parse", then "tags"
{"type":"preview","result":CrawlResult}        // card before the AI pass; open the form
{"type":"done","result":CrawlResult}           // final card (AI pass applied)
{"type":"failed","failed":true,"domain":"…","tint":"#…","stripe":"#…","initial":"N",
 "reason":"blocked|not-found|timeout|not-html|network|invalid-url","suggestedTitle":"…"}
{"type":"failed","failed":true,"reason":"network"}   // unexpected error: identity fields absent
```

```swift
struct CrawlResult: Codable {
    let domain, canonicalUrl, title, excerpt: String
    let articleText: [String]
    let heroImage, favicon: String?
    let tint, stripe, initial: String
    let contentType: ContentType
    let suggestedTags: [String]
    let readingTimeMinutes: Int?
    let excerptOnly: Bool?
    let product: ProductDetails?
}
struct CrawlFailure: Codable {           // every field optional except reason
    let reason: String
    let domain, tint, stripe, initial, suggestedTitle: String?
}
enum CrawlEvent: Decodable {
    case step(String), preview(CrawlResult), done(CrawlResult), failed(CrawlFailure)
    private enum K: String, CodingKey { case type, step, result }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: K.self)
        switch try c.decode(String.self, forKey: .type) {
        case "step":    self = .step(try c.decode(String.self, forKey: .step))
        case "preview": self = .preview(try c.decode(CrawlResult.self, forKey: .result))
        case "done":    self = .done(try c.decode(CrawlResult.self, forKey: .result))
        default:        self = .failed(try CrawlFailure(from: decoder))
        }
    }
}
// for try await line in URLSession.shared.bytes(for: req).0.lines { decode CrawlEvent }
```

If the stream ends without a `preview`, `done` or `failed` line, treat it as
`failed(reason: "network")`. Progress = (index of the last step in [fetch, parse]
+ 1) ÷ 2.

**`POST /api/import/check`** (no body): checks never-checked links, up to 600 per call
and about 4 minutes. NDJSON:
`{"type":"start","total":n}` → `{"type":"progress","checked":n,"dead":n}`… →
`{"type":"done","checked":n,"dead":[{"id","url","title","status"}],"remaining":n}`
or `{"type":"failed","reason":"…"}`. **Call again while `remaining > 0`.**

**Cron (server only)**: `GET /api/cron/price-check` (every 12 h),
`GET /api/cron/link-check` (daily 04:20 UTC), both protected by `CRON_SECRET`.

**Images**: `heroImage` is either the original site URL (right after saving) or a
**public Supabase Storage WebP** (≤1600 wide). Both load with a plain `AsyncImage` or
image cache; iOS decodes WebP natively.

### 6.2 What's missing for a native client ❌

Everything else in the web app runs as **Next.js Server Actions** (functions called
by the web UI) and a server-rendered library read. Those aren't a stable public API.
An iOS client needs REST (or Supabase PostgREST + RLS policies) equivalents:

| Server action (today) | Proposed endpoint |
|---|---|
| `getLibraryData()` → `{links, trashed, collections}` | `GET /api/library` (later: `?since=` for incremental sync) |
| `createLink(input)` | `POST /api/links` |
| `setLinkSize(id, size)` · `setFavorite(id, bool)` · `setNote(id, text)` | `PATCH /api/links/{id}` |
| `moveLinks(ids, collectionId)` · `tagLinks(ids, tag)` · `archiveLinks(ids)` · `deleteLinks(ids)` · `restoreLinks(ids)` · `purgeLinks(ids)` | `POST /api/links/bulk {action, ids, …}` |
| `reorderLinks(ids)` | `POST /api/links/order` |
| `createCollection(name, color)` · `createSmartCollection(query, name)` · `renameCollection` · `deleteCollection` · `deleteEmptyCollections` · `reorderCollections(ids)` | `/api/collections` (CRUD + `/order`, `/cleanup`) |
| `addHighlight(linkId, quote)` | `POST /api/links/{id}/highlights` |
| `setAlertThreshold(linkId, threshold, currency)` | `PUT /api/links/{id}/price-alert` |
| `importLinks(items)` | `POST /api/import` |
| `groupInbox(priorities)` | `POST /api/import/group` |
| `logSignal(action, {linkId, linkIds, collectionId, payload})` | `POST /api/signals` (fire and forget) |

### 6.3 Auth ❌ (blocking)

The web app is **single-user**: the server reads one fixed user id from an
environment variable, and there's no login or session. All tables already carry
`user_id` and have Row Level Security enabled, with no policies yet. Before any iOS
build, the backend needs real accounts. The natural fit is **Supabase Auth with Sign
in with Apple** (plus email magic link for the web), with endpoints scoped to the
session user. Design screens for: Sign in, Signed out, Account in Settings, and
Delete account (App Store requirement).

---

## 7. Not built / known gaps

Design these as **new** if they're in scope, never as existing behaviour.

| Gap | Note |
|---|---|
| Accounts, sync across devices | §6.3, blocking for iOS |
| iOS share sheet / native app | This project |
| Browser extension | Planned as a thin client of the same API |
| Enrichment of imported links | Imported links have only a title + URL: no excerpt, hero or tags until a backfill job exists. **Design the "plain" card state** (tint fallback hero, no excerpt) as common, not rare. |
| Price-drop notifications | Thresholds are stored; nothing compares or sends them (the cron only records prices) |
| "% since saved" | `previousPrice` is never filled; compute it from `priceHistory.first` vs the latest |
| Same product at other retailers | Cut from v1 |
| Full spec tables, variants | Generic parsing rarely finds them |
| Unarchive | Archive is one-way in the UI |
| Delete / annotate highlights; a highlights list | Only "add" exists |
| Rename the inbox | Not exposed |
| Per-view manual order | One global position per link |
| Regroup the whole library | Onboarding only groups what's in Unsorted |
| Notion import | Deferred |
| Using `user_signals` | Recorded, never read |
| Settings screen | Doesn't exist on the web (theme is a toggle in the drawer) |

---

## 8. Screens & states checklist

Design each in **light and dark**, iPhone first, then iPad where noted.

1. **Welcome / Sign in** (new): wordmark + chain mark over orbs, "Paste anything.
   We read the rest.", Sign in with Apple.
2. **Onboarding**: Import (empty, files chosen with counts, each error) · Clean
   (checking, dead list, none dead) · Calibrate (all four questions, Keep/Bin) ·
   Grouping (wait) · Results (cards with reasoning, kept/binned, nothing to group).
3. **Links tab**: tiles · rows · empty library · filtered (query chip) · loading
   skeleton · pull to refresh · entrance · tile in lifted/drag state · selection mode
   with the bulk toolbar · imported "plain" cards without images.
4. **Per-link actions**: long-press context menu with preview · ⋯ sheet (main list,
   Move sub-list) · swipe actions on rows · toasts (Moved to Trash + Undo, Moved to
   {name}, Link copied).
5. **Collections tab**: full list with every section · new collection sheet · rename ·
   delete confirm · suggested collection create/dismiss · tags expanded · Settings
   entry.
6. **Collection**: header with reasoning · tag chips · smart-collection variant (query
   chip) · empty · multi-select (Move menu, Tag alert, Delete confirm).
7. **Search**: empty (recent links + collections) · typing with highlights · tokens
   (`type:video`, `#design`, `-#work`) · "Show all n matches" · no matches · Save as
   filter alert.
8. **Add a link sheet**: idle with a clipboard URL · idle without one · crawling 0 /
   50 / 100 % · ready (crawled) · ready while refining · excerpt-only notice · failed
   notice · collection error · saving · keyboard up.
9. **Share Extension**: compact crawl → form → saved confirmation.
10. **Link detail**: article with image · without image (tint fallback) · short page
    showing the excerpt · highlights + the Highlight action · note open · Move menu ·
    video variant · "Also in your library" empty · bottom Open button.
11. **Product detail**: rich data · realistic minimal data (price, stock, rating) · no
    price · history with fewer than 2 points · chart with threshold · alert field
    focused · out of stock.
12. **Trash**: list · empty · Empty Trash confirm.
13. **Settings** (new): appearance (System/Light/Dark), open links in
    (AnyLink/Safari), import, guided tips reset, account, sign out, delete account.
14. **iPad**: split view with sidebar + S/M/L mosaic · pointer hover islands ·
    detail · search.
15. **Widgets** (P2): Recently saved (small, medium) · Price watch (medium).
