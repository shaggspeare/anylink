# 04 · Screens (version B)

Reference device: iPhone 402 × 874 pt. Safe area: top 62, bottom 34. Every screen lists:

- **Layout**, top to bottom;
- **States**, all of which must have previews;
- **Interactions**;
- **Copy**, verbatim;
- **Done when**, the acceptance criteria.

Nav bar convention: tab roots use a large title in `AL.Font.largeTitle` (Instrument Sans), drawn as the first row of
the scroll content. Floating glass controls sit at y=62 (44 pt high, 16 pt side inset). Use `.toolbar` items with
glass where possible. Hide the system navigation title on tab roots so the brand title shows.

---

## S1 · Welcome / Sign in

**Layout:**
- `Orbs(.addLink)`.
- Logo (chain mark 30) + "AnyLink" (17/600, −0.6).
- Demo: a URL capsule "nasa.gov/missions/artemis/suit-cost" (mono 12), the eyebrow "↓ AnyLink reads it", and a
  290-wide sample card (hero, nasa.gov · 6 min read, title). The card floats gently; it is static under Reduce Motion.
- Headline `hero`: "Paste anything." / "We read the rest."
- A three-column strip:
  - **Save**: "from any app's share sheet"
  - **Organise**: "collections build themselves"
  - **Find**: "even inside the article text"
- `SignInWithAppleButton` (h52, `.signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)`), then
  **Continue with email** (glass, h52).

**States:** idle · signing in (button disabled, progress) · error toast "Couldn't sign in. Try again."

**Interactions:**
- Apple sign-in → `AuthService` → if the library is empty, onboarding; otherwise, the main tabs.
- Email → a sheet with an email field and "Send link", then "Check your inbox — the link signs you in on this iPhone."

**Done when:** works with the Supabase Apple provider. MockAPI auth succeeds instantly under `-ui-testing`.

---

## S2 · Onboarding 1: Import

**Header** (all onboarding steps): a 4-step indicator. The current step is a 22×4 signal bar; others are 8×4 (done:
ink .40, todo: ink .15). Then "1 of 4" (SF 13, ink .50). On the right, **Skip** (SF 15, ink .60), shown only on this
step.

**Layout:**
- Large title "Bring your links". Lead: "Your exports go only into your own library. Dead links get stripped out next."
- Two frosted source cards (r22, padding 16). Each has a 40×40 r12 icon tile, a name (15/600) and a subtitle (meta):
  - **Browser bookmarks**: "Chrome, Safari, Firefox, Arc — any HTML export". Steps:
    1. Open the bookmark manager
    2. Export bookmarks → HTML file
    3. AirDrop it to this iPhone
  - **Telegram Saved Messages**: "Message text is kept as context". Steps:
    1. Telegram Desktop → Saved Messages
    2. ⋮ → Export chat history → format JSON
    3. AirDrop result.json to this iPhone
  - Unchosen cards show the steps and a **Choose file** button. Chosen cards get a 2 pt ink border, and a lime .38
    strip "✓ filename · 1,102 links" with ✕ to remove the file.
- Info row: "Exports usually live on your computer. AirDrop them here, or save them to iCloud Drive — they show up in Files."
- Bottom: **Import {n} links** (ink h52; disabled with the label "Choose a file to import" when n = 0), then a text
  button **Start with an empty library**.

**Interactions:**
- `.fileImporter(allowedContentTypes: [.html, .json], allowsMultipleSelection: true)`.
- Parse on device with `BookmarksParser` (Netscape HTML; keep the folder path and `ADD_DATE`) and
  `TelegramParser` (JSON; keep the message text as context).
- Merge the results; the first occurrence of a URL wins. Max 5,000 links. Then `POST /api/import`.

**Errors** (notice under the card, verbatim from spec §4.15):
- "No links in that file. A Chrome bookmarks export or a Telegram result.json both work."
- "Couldn't read that file — is it the export itself, rather than a zip of it?"
- "The import didn't go through. Nothing was saved — try again."

**Done when:** both parsers have unit tests on real export samples in `Fixtures`, and the counts are correct.

## S3 · Onboarding 2: Clean

**Layout:**
- Title "Checking what still exists".
- A 176 pt ring (track ink .07, lime progress, width 12) with the checked count in the centre (40/600, monospaced
  digits) and "of {total} checked".
- A glass status pill:
  - while running: pulsing signal dot + "You can leave — we'll keep checking";
  - when done: green check + "Every link answered or was flagged".
- "Found so far" + a frosted list of three selectable rows (check circle, name, description, count):
  - **Gone**: "404 or 410 — the page no longer exists" (selected by default)
  - **Parked domains**: "The domain is for sale now" (selected)
  - **No answer**: "Often a temporary outage — kept by default" (not selected)
- Bottom: **Move {n} to Trash** (n = sum of selected groups; "Continue" when 0), then text **Keep them all for now**.

**Behaviour:**
- Call `POST /api/import/check` (NDJSON) and repeat while `remaining > 0`.
- Map `status` 404/410 → Gone, 1 → Parked, 0 → No answer.
- The step is resumable. If the user leaves, resume on next launch from the onboarding banner.
- *Review all* (optional) pushes a list of dead links with status codes.

**Done when:** the progress animates with streamed events, and the Mock replays a 1,284-link run in ~3 s.

## S4 · Onboarding 3: Keep or bin

**Layout:**
- Title "Keep or bin?" with a lead "{i} of 8 · sampled across your sites".
- A `SwipeCardStack` card showing: hero, badge + domain, title (19/600), the import context (folder path or "Telegram · “for the redesign”") and the saved date.
- Bottom: a 64 pt ink ✕ **Bin** button and a 64 pt lime ✓ **Keep** button, each labelled below.
- Footnote: "Swipe right to keep, left to bin." / "Binned links go to Trash, not away forever."

**Behaviour:**
- Eight cards, sampled across domains.
- Binning moves the link to Trash.
- Each decision logs a `keep`/`kill` signal.
- The free-text questions from spec §4.15 come on the next screen, one per screen: "What are you working on right
  now?" and "Anything you'd rather never see again?". Each has suggestion chips built from the folder names and
  top domains, plus a text field.
- **Build my collections** calls `POST /api/import/group`.

## S5 · Onboarding 4: Collections result

**Layout:**
- Title "We made {n} collections". Lead: "Based on what you told us. Bin any that miss."
- One frosted card per collection:
  - dot, name (16/600), count;
  - reasoning (12.5, ink .55). When binned, the reasoning is replaced by "Binned — its {n} links go back to Unsorted.", and the card dims to .6;
  - 3 sample titles with 18 pt badges;
  - a `KeepBinSegment`.
- A glass footer pinned at the bottom: "{k} kept · {b} binned — {n} links go back to Unsorted", then **Open my library**.
- While grouping: "Building your collections" / "Reading every title against what you just told us. About twenty seconds." with an indeterminate ring.

**Done when:** binning sends the links back to Unsorted, deletes the collection and logs a signal. The summary updates live.

---

## S6 · Library (tab 1)

**Layout:**
- `Orbs(.library)`.
- Top-right glass capsule: **layout switch** (`list.bullet` ⇄ `square.grid.2x2`) and a **Sort** `Menu`:
  Newest first · Oldest first · Title A–Z · Site A–Z · My order.
- Large title "Library".
- Scope chips, built-in filters with counts (hide a chip when its count is 0, except All):
  All · Unsorted · Favorites · Videos · Products · Articles.
- `UnsortedBanner`, shown when Unsorted > 0 and scope = All.
- Content: the `LinkTile` grid, or `LinkRow` list grouped by save date (Today · Yesterday · Earlier this week ·
  month names) when sort = Newest.
- Bottom: the `PasteAccessory` and the tab bar.

**States:**
- tiles · rows · loading skeleton (6 grey tiles) · pull to refresh (`.refreshable`) · entrance animation
- plain imported cards (no image, no excerpt) · scope with no results ("Nothing here yet.") · offline banner
- **empty library** (below) · **select mode** (below)

**Empty library:**
- Three dashed placeholder tiles, then the title "Nothing saved yet" and the lead "Three ways in. The share sheet is the one you'll use most."
- A frosted list of three rows, each with a numbered tile:
  1. **Share from any app**: "In Safari, tap Share → AnyLink. Pin it to the top row." Opens a TipKit tip or video.
  2. **Paste a link**: "Copy a URL, then tap Paste at the bottom of any tab."
  3. **Import what you have**: "Browser bookmarks or Telegram Saved Messages." Opens onboarding at Import.

**Interactions:**
- Tap a tile or row → `Route.link`.
- Long press → context menu (S7).
- Rows: swipe actions (leading Favorite; trailing Move, Trash).
- **Select mode** (entered from the capsule's select button or the context menu's *Select*):
  - The nav becomes **Select All / Deselect All** · "{n} Selected" · **Done** (ink).
  - Tiles show check discs. Rows use `List(selection:)`, so two-finger pan selection comes free.
  - The tab bar and accessory are replaced by a glass bottom toolbar: **Move** (sheet with the collection list) ·
    **Tag** (sheet: field + suggestions) · **Archive** · **Trash** (red; confirmation dialog
    "Delete {n} links?" / "They move to Trash. You can restore them from there." / **Move to Trash**).
  - Toolbar buttons are disabled when nothing is selected.
- Sort = My order: tiles get `.draggable` and `.dropDestination` (P1). Dropping saves the order with `POST /api/links/order`.

**Toasts:**
- "Moved to Trash" · "{n} links moved to Trash" · "Moved to {collection}" (each with Undo)
- "Archived {n} links" (Undo)
- "Tagged {n} links #{tag}"
- "Added to favorites" / "Removed from favorites"

**Done when:** all states have previews. Undo restores exactly the previous state. VoiceOver reads each tile as one
element with rotor actions.

## S7 · Link context menu

`.contextMenu(menuItems:preview:)` on tiles and rows.

**Preview:** 310 wide, paper background, hero h140, "domain · meta · collection", title 17/600, 2-line excerpt.
Tapping the preview opens the link.

**Items:**
1. Open Original
2. Share… (`ShareLink`)
3. Copy Link → "Link copied"
4. *(divider)*
5. **Move to…** (sub-`Menu` listing collections other than the current one, each with its colour dot)
6. Favorite / Unfavorite
7. Select
8. *(divider)*
9. **Move to Trash** (destructive)

There's no card-size item on iPhone.

## S8 · Add a link sheet

Opened from the accessory, ⌘N, the Library empty state, or `anylink://add?url=`.

**Idle:** `.presentationDetents([.medium])`, system glass background.
- Grabber, then the eyebrow "NEW LINK" with a signal dot.
- `sheetHero`: "Paste anything." / "We read the rest."
- Clipboard line:
  - with a URL: lime dot + "There's a link on your clipboard";
  - without: grey dot + "Nothing to paste yet — type a URL below".
- **Paste & read**: a `PasteButton(payloadType: URL.self)` styled as the signal capsule, h56.
- "or type a URL" + a capsule URL field with a round ink → button. The field accepts input without a scheme and adds
  `https://`.
- A dashed card: "Faster from Safari" / "Share → AnyLink saves the page you're on in one tap." It opens the
  share-sheet tip.

**Crawling:** the detent animates to `.large`.
- Sheet header (SF): **Cancel** · "New link" · **Save now** (signal capsule; enabled; saves what is known so far).
- A preview card that "develops":
  - Step 0: skeleton hero (shimmer) and skeleton lines.
  - Step 1 (as soon as the domain is known): HeroFallback from `AL.identity(domain)`, the badge and the domain.
  - Step 2 (`preview` event): title, excerpt, "Article · 6 min".
  - Step 3 (`done`): tags.
- Status line (SF 13): "✓ Found the page · ● Reading it… · Tags", driven by `step` events. The dot pulses.
- "Collection — you can pick while it reads", followed by collection chips. Unsorted is preselected; the first 5 collections are shown.
- Tag skeleton capsules.

**Ready:**
- The header button becomes **Save**.
- The card title becomes an editable 2-line `TextField(axis: .vertical)` with a dashed underline.
- While the AI pass runs, an inline "✦ refining" chip (periwinkle) sits after the excerpt.
- "Save to": the same chips. The suggested collection gets a small ✦; it is never auto-selected.
- Tags: lime pills with ✕, plus "+ suggestion" outline chips. Suggestions are the crawler tags plus library tags
  mentioned in the title, excerpt or domain, max 8.
- Note field: "Why you saved this, what to do with it…".
- A pinned signal button: **Save to {collection}**.

**Excerpt only:** a notice above the card: "The site wouldn't give up the full page — this card is built from its metadata and written up by AI. Worth a glance before you save."

**Failed:**
- Notice: "The page wouldn't open ({reason}) — the title is guessed from the link. Edit it and save; nothing else is needed."
- The title comes from the `suggestedTitle` in the failure event, or from guessing the URL slug.
- No tags.

**Rules:**
- Principle 3: per-field `edited` flags; a `done` event never overwrites an edited field.
- Saving dismisses the sheet with `.success` haptics, and the new link appears first in Library.
- Toast "Saved to {collection}", or "Saved to {collection} — still reading the page" when saved mid-crawl. Both have Undo.
- **BACKEND:** saving mid-crawl requires the server to finish enrichment for a saved link (`05` § Gaps). Until then,
  keep the crawl stream alive in the app after save and `PATCH` the link when `done` arrives. If the app is
  backgrounded first, the link stays as saved.

**Done when:** the Mock streams success, excerpt-only and failed. Cancelling mid-crawl cancels the task.
Editing the title during "refining" survives the `done` event (unit-tested in `AddLinkModel`).

## S9 · Share Extension

Activation: a web URL (max 1), or text that contains a URL.

**Layout** (medium-sheet look, glass):
- Grabber, then a 48 pt lime check disc with "Saved to Unsorted" (22/600) and "You can close this — it's already in your library."
- A link row card: thumb 52 r13, domain, title. Below it, the status line:
  - while crawling: pulsing dot + "Summary and tags are on the way";
  - when done: ✓ + "Summary and tags added".
- "Move to": chips for the 4 most recent collections. Tapping one moves the link and changes the title to "Saved to {name}".
- "Add a note (optional)" field.
- **Done** (ink h52).

**Behaviour:**
- On appear, call `POST /api/links` immediately with the URL plus title and favicon from the extension context.
- Start the crawl in the background. Keep total memory under the extension limit (no image decoding beyond the thumb).
- Offline → write a `PendingSave` to the App Group store and show "Saved — it will sync when you're online."
- Auth comes from the shared keychain. If there's no session: "Open AnyLink once to sign in, then share again." with
  a button that opens `anylink://`.

---

## S10 · Collections (tab 2)

**Layout:**
- Top-right: a glass **+** (New collection) and an avatar circle (initial on periwinkle) → Settings.
- Large title "Collections".
- Filter chips: Favorites (★) · Videos · Products · With a note · Untagged · Broken · Duplicates, each with its count
  and hidden when 0. Each opens `Route.filter`.
- Suggested filter banner (periwinkle .16 fill, .35 border):
  - "Make “{Tag}” a filter?" / "{n} links tagged #{tag}"
  - **Create** (ink) and ✕ (dismiss; remembered per device in `@AppStorage`).
  - Shown when a tag is on ≥ 3 live links and isn't already a collection or filter name.
- An Unsorted card (frosted): slate dot, "Unsorted", "{n} links waiting · new links land here", and **Sort** (lime) when n > 0.
- `CollectionCard` grid with a "New collection" cell at the end.
- "Custom filters": a frosted list with a periwinkle dot, the name, the query (monospaced 11, ink .45) and a count.
- "Tags": a wrapping chip cloud, top 10 by count.
- Quiet list (surface .45): Import links › · Trash {n} › · Delete empty collections ("Removed {n} empty collections").

**Sheets:**
- New collection: name field, 5 swatches (`AL.collectionSwatches`) as radio buttons, **Add collection**.
- Rename: the same sheet with the name prefilled.

## S11 · Collection

**Layout:**
- Back (glass circle).
- Top-right capsule: **Select** and ⋯. The ⋯ menu has Rename, Dissolve, Sort and Share list (P2).
- Dot 12 + large title, then "{n} links · made during import" (or "· new links land here" for Unsorted).
- `WhyCard`, shown for auto-made collections until the user taps Keep.
- For Unsorted: a signal button **Sort {n} links one by one** → Triage.
- Tag chips: All + the tags in this collection, single-select, horizontal scroll.
- A frosted `List` of `LinkRow`s.

**Empty:** "Nothing here yet — paste a link to save your first one into this collection."

**Dissolve:** confirmation dialog "Dissolving moves its links back to Unsorted and deletes the collection." /
**Dissolve collection** (destructive). Then pop back, with toast "{name} dissolved — {n} links back in Unsorted" and Undo.

**Accessory:** inside a collection it reads "Paste into {name}", and the Add sheet preselects this collection.

## S12 · Filter results

Back button; large title (the filter's name); an ink query chip (monospaced 11) with "{n} links"; rows with
"domain · collection" meta; empty state "No links match this filter."

---

## S13 · Search (tab 3, `Tab(role: .search)`)

**Layout:**
- Large title "Search".
- "Narrow it down": suggested token chips (outline; ✓ when active): Videos · Articles · Products · Favorites ·
  #{top tag} · #{second tag} · Not #work.
- Results:
  - **Empty query:**
    - "Recently saved": 5 rows.
    - "Saved filters": chips.
    - Hint: "Try async, #space or ramen. Search looks inside summaries and notes too."
  - **With a query:**
    - "Links · {n}" and a **Save as filter** button. Saving shows an alert with a name field prefilled from the
      query, then the toast "Saved as a filter in Collections".
    - Rows highlight the match with a lime `AttributedString` background and `onAccent` text. When the match is in
      the summary, note or article text rather than the title, a snippet box appears under the row:
      "In the summary/note/article", followed by "…context with the **match**…".
    - "Collections" chips whose names match.
    - "No matches."

**Search field:** iOS 26 places it at the bottom; the tab bar collapses to a circle.
- Use `.searchable(text:tokens:placement:prompt:token:)` with prompt "Search links, #tags…".
- The parser turns recognised operators typed in the field into tokens (`06-query-language.md`).

**Behaviour:**
- Search runs on device over `LibraryStore` and is debounced by 120 ms.
- Results show the first 50; "Show all {n} matches" pushes `Route.filter(query)`.

## S14 · Sort Unsorted (triage, new in B)

**Layout:**
- Nav: back · "Sort Unsorted" with "{i} of {total}" (SF) · **Done** (glass).
- A 4 pt progress bar (lime).
- Suggestion pill (periwinkle .18): "✦ Looks like **{collection}**".
- `SwipeCardStack`: hero, "domain · meta · saved from {source}", title, excerpt, tag pills.
  - Right stamp: the collection name in signal; left stamp: TRASH in ink.
- "Or:" chips for 3 other collections.
- Bottom row: a 60 pt ink trash circle · glass **Later** · signal **{collection} →** (fills the remaining width).

**Behaviour:**
- Swipe right files the link into the suggestion; left moves it to Trash; Later skips it for this session.
- Each action gets a toast with Undo and logs a signal (move/kill/keep).
- Suggestion source: `LibraryStore.suggestedCollection(for:)`:
  - the collection whose links share the most tags with this link, ties broken by domain overlap;
  - else none, in which case the button reads **Choose a collection** and opens the Move sheet.
  - **BACKEND (later):** a server-side suggestion per inbox link.

**Done state:** a lime check disc, "Unsorted is clear", "Everything has a home. New links will land here again until you sort them.", **Back to library**.

---

## S15 · Reader (`Route.link` for articles and videos)

**Layout:**
- A full-bleed stretchy hero, h400, that scales on overscroll. Image, or HeroFallback, under the black reader scrim.
- Bottom-left on the hero: the eyebrow "{domain} · {n} min read", then the title `readerTitle` in white.
- Floating at y=62: a back button (glass on dark), and a capsule with ★ (favourite toggle, signal when on) and ⋯
  (the S7 menu items + Add to collection).
- Body, padding 20/24:
  - A chip row: collection chip (dot, name, chevron; opens the Move sheet) · tag chips (each opens `Route.filter(#tag)`) · "Saved {date}".
  - A note card when a note exists (lime .22 fill, pencil icon, 14 pt text). Tapping it edits the note in place,
    in a `TextField(axis: .vertical)`. It saves on submit or blur, with the toast "Note saved".
  - Article text, 17 pt, line height 1.65, ink .85, paragraph spacing 22.
    - Rendered from `articleText` blocks in a `UITextView` wrapper so the edit menu gets a **Highlight** action (`07-ios-native.md`).
    - Highlights show with a lime .60 background.
    - If fewer than 40 words of real prose (paragraphs of 8+ words), show the excerpt plus a notice: "The site wouldn't give up the full page, so this is the summary only. Open the original to read the rest."
  - "Also in {collection}" with **See all**: a horizontal scroll of 150-wide mini cards (hero 64).
- A bottom glass toolbar (no tab bar): Note · Highlight (adds a highlight on the current selection, or shows a tip
  explaining how) · Share, then a signal capsule **Open ↗** (SFSafariViewController, or Safari, per Settings).

**Video variant:** a 190 pt thumbnail with a 56 pt play disc that opens the original, then the description and
"Video — open the original to watch. AnyLink stores the description and thumbnail only."

**Broken link:** a slate "Gone" chip in the chip row. Open still works.

## S16 · Product (`Route.link` with `contentType == .product`)

**Layout:**
- Floating back and ⋯ buttons.
- An image card (white, r28, h260, product image shadow).
- Retailer row: a 20 pt retailer badge (`retailerColor`, initial), the domain, and on the right an In stock chip
  (green .14 + dot) or "Out of stock" (ink .06).
- Title `productTitle`. Price `price`, with a lime pill "−{n}% since saved" computed from `priceHistory.first`
  vs the latest snapshot (hidden when ≤ 0).
- Meta (SF 13): "Was {first} when you saved it on {date} · {rating} ★ ({reviews})", omitting parts that are missing.
- **Price** card:
  - Range picker 1M · 3M · All.
  - Swift Charts: `LineMark` + `PointMark` (periwinkle, 3 pt, emphasised last point), a dashed `RuleMark` at the
    alert threshold (signal) labelled "Alert ₴50,000", x labels at the start and end.
  - With fewer than 2 snapshots, show "Checked twice daily — history will show up after the next check." instead.
  - "Tell me under": a currency prefix and a decimal-pad field, saved on submit or blur (`PUT /api/links/{id}/price-alert`).
  - "Push notification" toggle. **BACKEND:** hidden until price push ships; feature-flagged `FeatureFlags.pricePush`.
  - "Checked twice a day · last check {relative}".
- "Specs AnyLink pulled · {n}": up to 3 rows, then "Show all {total}" when there are more. Hidden when there are none.
- Bottom: a glass capsule with ★ and Share, then a signal **Open on {retailer}**.

## S17 · Trash (`Route.trash`)

**Layout:**
- Back button; **Empty** (red, glass) on the right when there are items.
- Large title "Trash", then "{n} links · they stay here until you delete them".
- `List` grouped by deletion day (Today · Yesterday · weekday · date). Rows have a thumb at .8 opacity, the title and
  "from {collection} · {relative time}".
- Swipe actions: leading **Restore** (lime, `arrow.uturn.backward`), trailing **Delete** (destructive).

**Confirmations:**
- Delete: "Delete forever?" / "This link and its saved image are removed for good."
- Empty: "Empty Trash?" / "{n} links will be deleted for good." / **Empty Trash**

**Empty state:** "Nothing here. Deleted links land in Trash until you empty it."

## S18 · Settings (`Route.settings`, pushed from the avatar)

**Layout:**
- An account card: avatar 52, "Your account", "Apple ID · {n} links · synced {relative}".
- **Capture**:
  - Share sheet (opens a tip explaining how to pin AnyLink)
  - Siri & Shortcuts — "“Save to AnyLink”" (`ShortcutsLink` / opens Shortcuts)
  - Clipboard suggestions (toggle; when off, the accessory never shows the clipboard state)
  - New links go to — Unsorted (picker)
- **Appearance**: three thumbnails (System / Light / Dark) → `.preferredColorScheme`, stored in `@AppStorage`.
- **Reading**: "Open links in" (AnyLink | Safari) · Show tips again (`Tips.resetDatastore()`).
- Sign out · **Delete account…**: confirmation "Delete your account?" / "Your library, collections and notes are
  deleted from every device. This can't be undone." Required by the App Store.
- Footer: version and build.

---

## Global copy catalogue (toasts and errors)

| Key | Text |
|---|---|
| toast.trash.one | Moved to Trash |
| toast.trash.many | {n} links moved to Trash |
| toast.moved | Moved to {collection} |
| toast.copied | Link copied |
| toast.copyFailed | Couldn't copy the link |
| toast.saved | Saved to {collection} |
| toast.savedEarly | Saved to {collection} — still reading the page |
| toast.restored | Restored to {collection} |
| toast.emptied | Trash emptied |
| toast.note | Note saved |
| toast.highlight | Highlighted |
| toast.filterSaved | Saved as a filter in Collections |
| toast.emptyRemoved | Removed {n} empty collections |
| error.offline | You're offline. Changes are saved and will sync when you're back. |
| error.generic | That didn't go through. Try again. |
| error.invalidURL | That doesn't look like a link — it should start with https:// |
