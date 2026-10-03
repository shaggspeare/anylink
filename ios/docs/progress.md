# Progress

## Phase 0 · Scaffold

**Status:** Done

### Done
- Copied `templates/project.yml` to root (team ID left empty for simulator builds)
- Created folder layout per `02-architecture.md` suggested layout
- Created `Packages/AnyLinkKit` with all 7 modules + 7 test targets, `swift-tools-version: 6.2`
- `Tokens.swift`: full `AL` enum from spec §15 + `03` §1 additions (Ink expanded, Motion, Shadow, B additions), `Color(hex:)`, `Color.themed()`, `View.alShadow()`
- Bundled Instrument Sans variable TTF; `AL.registerFonts()` via `CTFontManagerRegisterFontsForURL`; `AL.Font.brand()` + full type scale; DEBUG PostScript name log
- `Config.example.xcconfig`, `AppConfig` (reads Info.plist keys), `FeatureFlags`
- `RootView` showing "AnyLink" in `largeTitle` over `Orbs(.library)`
- `Orbs.swift` with all 7 variants, respects Reduce Transparency and dark mode
- `Localizable.xcstrings` (English), `Assets.xcassets` with AppIcon placeholder
- `.gitignore` updated: `*.xcodeproj` ignored (D16)
- Info.plist, entitlements, ShareExtension placeholder, UITests placeholder
- `scripts/verify.sh`: `xcodegen generate` → `swift test` → `xcodebuild build` (CI `-warnings-as-errors`)
- `verify.sh` passes, `swift test` passes (7 placeholder suites), app builds for simulator

### Not done
- App icon asset (placeholder only — actual icon is phase 13)
- `largeTitle` font is system, not Instrument Sans (NavigationStack `.navigationTitle` uses system font by default; customising it requires a custom title view, deferred to phase 3 when `MainTabs` is built)

### Spec conflicts
- None found

### `// BACKEND:` items
- None

### Check by hand
- Launch in simulator: confirm "AnyLink" title visible, orbs render in both light and dark mode
- Verify Instrument Sans PostScript names logged in console on launch

---

## Phase 1 · Models, fixtures, MockAPI, query language

**Status:** Done

### Done
- `Models`: all structs from spec §3 with `05` §1 changes — `LinkItem`, `LinkCollection`, `CrawlResult`, `CrawlFailure`, `CrawlEvent` (custom `Decodable`), `LinkDraft`, `LibrarySnapshot`, `LinkPatch`, `BulkAction`, `LinkCheckEvent`, `ImportItem`, `ImportResult`, `GroupingPriorities`, `GroupedResult`, `Signal`, `AppError`. Computed helpers: `isBroken`, `hasNote`, `readingMeta`, `retailerShortName`.
- `Fixtures`: loads `library.json` (18 links + 2 trashed + 7 collections) and all 3 crawl NDJSON fixtures. 6 decode tests.
- `Networking`: `AnyLinkAPI` protocol (20 methods), `MockAPI` actor (latency, `failNext`, crawl replay via `_delayMs`), `NDJSONDecoder`. 4 tests including crawl replay ordering and failNext.
- `QueryLanguage`: parser, evaluator, `LibraryIndex` (precomputed haystacks + duplicate detection), `SearchToken`, round-trip serialisation. Full grammar: text, `#tag`, `field:value`, `type:`, `is:`, `created:` with `>/<`, negation, `match:or`. Archived links excluded unless `is:archived` present.
- Tests: all 20 rows from the `06` test table pass, crawl replay ordering, 5,000-link perf test (< 16 ms query time). 37 tests total, all green.
- `verify.sh` passes (xcodegen + swift test + xcodebuild build).

### Not done
- Nothing — all tasks complete.

### Spec conflicts
- `created:>2026-09-30` matches `ramen` (2026-09-30T18:00:00Z) via string comparison — this matches the web app behaviour, as noted in the spec.

### `// BACKEND:` items
- None added (existing gaps documented in `05` §7 remain).

### Check by hand
- Run `swift test --package-path Packages/AnyLinkKit` and confirm 37/37 pass.

---

## Phase 2 · Design system components + Gallery

**Status:** Done

### Done
- `Frosted` (+ `alForceSolid` env override so previews/Gallery can show the Reduce Transparency look; the system value is read-only).
- `HeroFallback` (Canvas bands + circle), `HeroImage` (AsyncImage → placeholder → fallback), `InitialBadge` (14/18/24/32), `CardScrim`, `ReaderScrim`.
- `LinkTile` (184 pt, 92 pt hero, video disc, favourite star, select outline + lime check), `LinkRow` (64 pt, select check).
- `ScopeChip`, `KeepBinSegment`, `UnsortedBanner`, `PasteAccessory` (UI only, Paste capsule placeholder), `ALField`, `Notice`, button styles (`.alPrimary`, `.alSignal`, `ALSmallButtonStyle(.lime/.ink/.soft)`, `ALLimeButtonStyle`).
- `CollectionCard` + `NewCollectionCard`, `WhyCard`, `SwipeCardStack` (drag + stamps + fly-out, Bin/Keep buttons, VoiceOver named actions, Reduce Motion skips fly-out).
- `Toast` + `ToastCenter` (5 s auto-hide, new replaces old) + `.toastOverlay`.
- DEBUG `GalleryView` via launch arg `-gallery`, with Dark / Reduce Transparency / Large Type toggles.
- Previews: light, dark, Reduce Transparency, large Dynamic Type.
- Tests: `ToastCenter` replace/dismiss, identity stability (38 total).

### Fixed from phase 0
- **Instrument Sans never loaded**: `.process` flattens `Resources/Fonts`, so the `subdirectory:` lookup failed. Fixed; `AL.Font.brand` now uses the per-weight PostScript names (`InstrumentSans-Regular_SemiBold`, …) logged at launch.
- `"▶ Video"` rendered as a colour emoji; now uses U+25B6 + text variation selector.

### Not done
- Tile press scale .97 and rotor actions: wired with the real actions in phase 4 (they need the store).
- `PasteAccessory` uses a styled placeholder instead of `PasteButton`; real one in phase 3.
- Increase Contrast ink bump: phase 13 accessibility pass.

### Spec conflicts
- `ScopeChip` text alpha is `.72` in `03` §6; there is no `Ink.a72` token, used `a75`.

### `// BACKEND:` items
- None.

### Check by hand
- Launch with `-gallery`; swipe the card stack both ways, use the Bin/Keep buttons, toggle Env menu options.

---

## Phase 3 · App shell

**Status:** Done

### Done
- `LibraryStore` (Store module): all intents from `02` (save, move, favorite, note, highlight, tag, archive, trash, restore, purge, emptyTrash, create collection/filter, rename, dissolve, deleteEmptyCollections, refresh). Each one is optimistic, syncs through a **strictly ordered** queue (so an Undo can't overtake the change it reverts), and rolls back with the `error.generic` toast on failure.
- `ToastCenter` (moved from DesignSystem into Store), `UndoCenter` (toast Undo + `UndoManager` shake, one-shot), `SignalLogger` (fire-and-forget).
- `Router` (Store module, so it's unit-tested): per-tab paths, select/pop/scroll-to-top, sheets, confirmations, `showsAccessory`, deep links `anylink://add?url=`, `anylink://link/{id}`, `https://…/links/{id}`.
- `AppEnvironment.mock()/.live()/.current()`; `MockAPI.fixtures()` moved into `Fixtures` (the old `withFixtures` returned an empty library).
- `MainTabs`: Library · Collections · Search (`role: .search`), `.tabBarMinimizeBehavior(.onScrollDown)`, `.tabViewBottomAccessory` with the real `PasteButton`; compact layout in the inline placement; "Paste into {name}" inside a collection.
- `ClipboardWatcher`: `detectedPatterns(for: [\.probableWebURL])` on active and on `changedNotification`, cached by `changeCount`, honours the `clipboardSuggestions` setting. No paste alert (checked in the simulator).
- Placeholder destinations for every route, sheet host (Add/Move/Tag/New/Rename, minimally functional), all confirmation dialogs with spec copy. Library, Collections and Search roots already show fixture data.
- Tests: 24 store tests (every intent, rollback via `failNext`, Undo restores exact state), 4 router tests. 66 total.

### Decisions
- `PasteButton` uses `payloadType: String` and extracts the first http(s) URL, because a `URL` payload stays disabled for plain-text links (Notes, Messages, `simctl pbcopy`). Tested.
- Accessory text uses `.primary/.secondary` rather than `AL.ink`: system glass adapts its scheme to what's beneath it, and `AL.ink` washed out.
- `createCollection`/`createFilter` are `async` and wait for the server id (capture-never-blocks applies to links, not collections).

### Not done
- `.offline` rolls back like any other error; the Outbox that keeps and queues it is phase 11.
- 404 → "drop the local item" (`05` errors table) isn't special-cased yet; it rolls back.
- `suggestedCollection(for:)` / `suggestedFilter`: phases 9 and 7, where they're used.

### Spec conflicts
- Server `deleteCollection` **trashes** a collection's links, but S11 "Dissolve" moves them to Unsorted. Dissolve is implemented as `bulk(.move → unsorted)` + `deleteCollection`.
- "Tagged {n} links" / "Archived {n} links" pluralise to "link" when n = 1.

### `// BACKEND:` items
- No unarchive endpoint: archive Undo is local-only (open question 4).
- No restore-collection endpoint: dissolve Undo recreates the collection with a new id, losing `reasoning`/`createdBy`.

### Check by hand
- Tap the active tab while on a pushed screen → pops; tap again at root → scrolls to top (`TabView` must call the selection setter on re-tap).
- Copy a link in Safari, return to AnyLink → accessory shows "Link on your clipboard" + Paste, with no alert.
- Long-press a tile → Move to Trash → toast with Undo; shake also undoes.

---

## Phase 4 · Library

**Status:** Done

### Done
- `LibraryView`: large brand title, scope chips with counts (zero-count chips hidden except All), `UnsortedBanner` (scope All, Unsorted > 0 → Triage), offline notice, tiles grid, rows `List` grouped by save date when sort = Newest, sort menu (5 sorts), layout switch, both persisted in `@AppStorage`.
- States: tiles · rows · skeleton (6 tiles while the first sync runs with no cache) · pull to refresh · entrance animation (`entranceScales` + stagger, skipped under Reduce Motion) · plain imported cards · "Nothing here yet." · offline · empty library (dashed tiles + three ways in) · select mode. Previews for each, plus dark and large type.
- `LinkActions` (S7): context menu (Open Original, Share…, Copy Link, Move to… submenu with colour dots, Favorite/Unfavorite, Select, Move to Trash) with the 310-pt preview card, and the 4 VoiceOver rotor actions on tiles and rows.
- Row swipe actions: leading Favorite (signal), trailing Trash (full swipe) + Move (periwinkle).
- Select mode: Select All / Deselect All · "{n} Selected" · Done (ink glass); tiles tap-toggle, rows use `List(selection:)` + edit mode; glass bottom toolbar Move · Tag · Archive · Trash (confirmation); tab bar and accessory hidden.
- Move sheet (collections with dots and counts, current excluded) and Tag sheet (field + 8 most-used tag suggestions).
- Store logic (tested): `LibraryScope`, `LibrarySort` (incl. My order by `position`), `DateSections.group` (Today · Yesterday · Earlier this week · month / month year), `Router` selection.
- UI tests: `testTrashAndUndoFromContextMenu` ✅, `testSelectModeTrashAsksForConfirmation` ✅. `AnyLinkUITests` gets `GENERATE_INFOPLIST_FILE` (it couldn't sign before).

### Fixes / decisions
- The paste accessory is now **disabled** (`tabViewBottomAccessory(isEnabled:)`, iOS 26.1+) rather than emptied in select mode and on detail screens: an empty accessory still draws glass over the bottom toolbar and swallows its taps. On iOS 26.0 it falls back to empty content, and the bug remains there. Raising the deployment target to 26.1 would remove the fallback: **owner's call**.
- Confirmation dialogs attach per tab inside each `NavigationStack` (only the selected tab presents).

### Not done
- Drag-to-reorder in "My order" (P1).
- Tapping the context-menu preview doesn't open the link (SwiftUI has no hook; would need UIKit).
- Empty-state rows "Share from any app" (TipKit, phase 13) and "Import what you have" (onboarding, phase 10) have no action yet.
- Images still use `AsyncImage`; the downsampling `ImageLoader` (`05` § Images) isn't built yet: fixtures have no hero images. Add it before live data (phase 11).

### Spec conflicts
- None new.

### `// BACKEND:` items
- None new.

### Check by hand
- VoiceOver on a tile: one element "Title, domain[, favourite]"; rotor shows Open original, Favorite, Move, Move to Trash.
- Shake after a trash → Undo.

---

## Phase 5 · Capture (Add sheet)

**Status:** Done

### Done
- `AddLinkModel` (Store): phases idle/crawling/ready/failed, step 0–3, per-field `edited` flags (title, excerpt, tags) so `done` never overwrites user edits, URL normalisation (adds `https://`), slug title guess for failures, tag add/remove, suggested tags (crawler + library tags mentioned, max 8), suggested collection (✦, never auto-selected), cancel, save / save-now.
- `LibraryStore.suggestedCollection(tags:domain:)` / `(for:)` (most shared tags, ties by domain) and `tagsByUse`. Triage (phase 9) reuses them.
- `AddLinkSheet`: idle (medium, eyebrow, hero, clipboard line, `PasteButton`, typed URL + ink → button, invalid-URL copy, "Faster from Safari" card) → large session: Cancel · New link · Save now/Save; developing card (shimmer → identity fallback → preview → done; hero 170 → 150), status line with pulsing dot, collection chips, tag skeletons → lime pills + "+ suggestion" chips + free entry, note field, pinned "Save to {collection}". Excerpt-only and failed notices with spec copy. Success haptics on ready and on save. Previews for each state.
- `LiveCrawler` (Networking): `POST /api/crawl` NDJSON, 70 s timeout, bearer token, 400 → `invalid-url`, missing terminal → `network`. Tested with a `URLProtocol` stub. Used automatically when `ANYLINK_API_BASE` has a host.
- `MockAPI.crawl`: cancellable (`onTermination` cancels the replay; counts `crawlsStarted`/`crawlsCancelled`), rewrites the success stream's domain/canonical URL to the pasted URL (`05` §5).
- Tests: title edited while refining survives `done` ✅, edited tags survive, all three Mock streams, cancel stops the network task (asserted on MockAPI) ✅, save after done / mid-crawl copy, normalisation. UI tests run success, excerpt-only, failed and invalid-URL flows ✅. 87 package tests, 6 UI tests.

### Fixes
- `AnyLinkAPI.crawl` / `checkImportedLinks` are now `async`. They were sync requirements implemented by the `MockAPI` actor through `@preconcurrency`, which **traps at runtime** when called through `any AnyLinkAPI`. `MockAPI` now conforms without `@preconcurrency`.
- Clipboard detection is off under `-ui-testing` so the accessory is deterministic.

### Not done
- Mid-crawl save stops the stream: there's no endpoint to PATCH title/excerpt afterwards, so the link keeps what was known (see BACKEND).
- ⌘N shortcut (iPad, phase 14). The "Faster from Safari" card's tip (TipKit, phase 13).
- A failed crawl's `domain/tint/stripe/initial` aren't sent with the draft (`LinkDraft` has no slot); MockAPI derives them. Revisit with `LiveAPI.createLink` in phase 11.

### Spec conflicts
- S8 says `PasteButton(payloadType: URL.self)`; it uses `String` + URL extraction, as in phase 3 (a `URL` payload stays disabled for plain-text links). The system button's label is "Paste", not "Paste & read" (`PasteButton` labels can't be changed).

### `// BACKEND:` items
- `AddLinkModel.save`: mid-crawl enrichment for a saved link (`05` § Gaps) — the server should finish it, or expose title/excerpt PATCH.

### Check by hand
- **Your `Config.xcconfig` has `ANYLINK_API_BASE = https://…` unescaped**, so it reaches the app as `https:` (xcconfig treats `//` as a comment). The app now ignores a base without a host and falls back to the Mock crawl. Write it as `https:/$()/your-host` to crawl live (`Config.example.xcconfig` documents this).
- Paste a real link with a live base configured: the card should develop step by step.

---

## Phase 6 · Link detail

**Status:** Done

### Done
- `LinkDetailView` picks `ProductView` (product with details) or `ReaderView`.
- `ReaderView` (S15): stretchy 400-pt hero with the black reader scrim, eyebrow + white `readerTitle`; glass back, ★ and ⋯ (S7 items + "Add to collection"); chip row (collection → Move sheet, tags → `Route.filter(#tag)`, "Saved {date}", slate **Gone** chip for broken links); lime note card edited in place (saves on submit/blur, "Note saved"); article text in `HighlightableText` (UITextView, Instrument Sans 17, spacing per spec, highlights on lime .60, **Highlight** in the edit menu); excerpt + "summary only" notice under 40 words of prose; video variant (190-pt thumb, play disc, notice); "Also in {collection}" mini cards with See all; bottom glass toolbar Note · Highlight · Share · **Open ↗**.
- `ProductView` (S16): white image card, retailer badge + stock chip, `productTitle`, `price` with "−{n}% since saved" (hidden ≤ 0), "Was … when you saved it on … · rating ★ (reviews)", Price card (1M/3M/All, Swift Charts line + points with emphasised last point, dashed alert rule with label, "Checked twice daily…" under 2 snapshots, "Tell me under" decimal field saved on submit/blur, push toggle behind `FeatureFlags.pricePush`, last-check line), specs card (3 rows + Show all), bottom ★ · Share · **Open on {Retailer}**.
- `SafariView` + `OpenOriginalHost`: every "open original" goes through `Router.openOriginal` and honours `@AppStorage("openIn")` (in-app / Safari; Settings in phase 7).
- Store (tested): `ArticleBody.hasEnoughProse` (< 40 words of 8+-word paragraphs) ✅, `PriceSummary` (% since saved hidden ≤ 0 ✅, chart hidden < 2 snapshots ✅, ranges, y-domain incl. threshold, grouped price format), `setPriceAlert` intent with rollback, `alsoIn`.
- UI tests: `testHighlightFromEditMenu` ✅ (double-tap a word → Highlight → "Highlighted"), `testProductPageShowsPriceCard` ✅.

### Decisions (logged D18–D20)
- No `preferredControlTintColor` on `SFSafariViewController`: deprecated in iOS 26.

### Not done
- The Highlight toolbar button needs a selection first; with none it shows "Select some text, then tap Highlight." (S15 says "or shows a tip"; TipKit lands in phase 13.)
- Highlights match the first occurrence of the quote (no stored offsets in the model).

### Spec conflicts
- None new.

### `// BACKEND:` items
- Price push notifications (`FeatureFlags.pricePush`, off).

### Check by hand
- Overscroll the reader hero: it should stretch, not gap.
- Settings → Open in Safari (phase 7) switches Open ↗ to Safari.

---

## Phase 7 · Collections, filters, Trash, Settings

**Status:** Done

### Done
- `CollectionsView` (S10): glass + and avatar → Settings; built-in filter chips with counts (hidden at 0) → `Route.filter`; suggested-filter banner (Create / ✕, dismissals in `@AppStorage`); Unsorted card with lime Sort; collection grid + New collection cell; Custom filters list (monospaced query, count); tag cloud (top 10); quiet list (Import links, Trash {n}, Delete empty collections).
- `CollectionNameSheet`: name + 5 swatches + **Add collection**; Rename reuses it with the name prefilled (no swatches — the API can't recolour).
- `CollectionView` (S11): dot + title + "{n} links · made during import / · new links land here"; `WhyCard` for system-made collections until Keep (kept IDs per device + `keep` signal); **Sort {n} links one by one** for Unsorted; tag chips (single select); rows with swipes and S7 menu; Select mode with the shared toolbar; ⋯ Rename / Dissolve; empty copy.
- `FilterResultsView` (S12): title, ink monospaced query chip + count, rows with "domain · collection", empty copy.
- `TrashView` (S17): title + count line, sections by deletion day, rows (thumb .8, "from {collection} · {relative}"), swipe Restore (lime) / Delete (confirm), Empty (confirm), empty copy.
- `SettingsView` (S18): account card, Capture (share-sheet hint, Shortcuts, clipboard toggle that also clears the accessory, "New links go to" — used by the Add sheet), Appearance thumbnails applied app-wide at once, Open links in (AnyLink | Safari), Show tips again (flag for TipKit in phase 13), Sign out, Delete account… (Mock), version footer.
- Shared `LinkListRow` and `SelectionToolbar` (Library and Collection use them).
- Store (tested): `BuiltInFilter`, `suggestedFilter`, `topTags`, `tags(in:)`, `trashSections` + local `trashedAt`, `deleteAccount`, `lastSynced`.
- UI tests: dissolve → Undo restores the collection ✅, Delete empty collections reports a count ✅, appearance switches immediately ✅. 99 package tests, 11 UI tests.

### Fixes
- Confirmation dialogs now present from the screen on top (tab root when its path is empty, else the last pushed route). Attached only to the root, they silently failed on pushed screens.

### Not done
- Sign out does nothing yet (toast); the auth gate and Welcome arrive in phase 10.
- Collection ⋯ "Sort" and "Share list" (P2).
- "Import links" shows a toast until onboarding (phase 10).

### Spec conflicts
- S17 groups Trash by deletion day, but the API has no `deletedAt`: only links trashed on this device this session are dated; the rest fall under "Earlier".

### `// BACKEND:` items
- `deletedAt` on trashed links (`trashSections`).
- A "keep" endpoint for auto-made collections (`CollectionView` WhyCard); kept state is per device.
- `DELETE /api/account` (`LibraryStore.deleteAccount`, Mock only).

### Check by hand
- Settings → New links go to → Reading, then Paste: the Add sheet preselects Reading.
- Turn off Clipboard suggestions: the accessory stops saying "Link on your clipboard".

---

## Phase 8 · Search

**Status:** Done

### Done
- `SearchModel` (Store): 120 ms debounce, typed operators become tokens when followed by a space (`type:video ` → **Videos**), query = tokens + typed terms, suggested tokens (types, Favorites, top 3 tags, "Not #{top tag}") with toggle, first 50 results + total, collections whose names match, highlight ranges, snippets ("In the summary/note/article" + "…context…"), Save as filter.
- `SearchToken(term:)` labels per the `06` table (incl. "Saved Sep 2026"); `Term.serialized` is public.
- `SearchView` (S13): large title, "Narrow it down" chips (✓ when active), `.searchable(text:tokens:)` with prompt "Search links, #tags…", keyboard submit runs at once; empty state (Recently saved · Saved filters · hint); results ("Links · {n}" + Save as filter alert prefilled from the query → toast), rows with lime/onAccent match highlighting, snippet box for non-title matches, "Show all {n} matches" → `Route.filter`, Collections chips, "No matches."
- Tests: 10 `SearchModelTests`; UI test `testSearchTokensSnippetsAndSaveAsFilter` ✅ (token, snippet, save as filter). 109 package tests, 12 UI tests.

### Not done
- `.searchSuggestions` completions in the field (the chips row covers suggestions).

### Spec conflicts
- S13 shows two tag tokens (#{top}, #{second}); `06` says top 3. Followed `06`.

### `// BACKEND:` items
- None.

### Check by hand
- On iOS 26 the search tab collapses the tab bar to a circle while searching; after Close it stays collapsed until another tab is picked from the circle. That's system behaviour.

---

## Phase 9 · Sort Unsorted (triage)

**Status:** Done

### Done
- `TriageModel` (Store): queue derived live from the inbox (so Undo returns a link to its place), Later set, `{i} of {total}`, progress, suggestion via `LibraryStore.suggestedCollection(for:)` (most shared tags, ties by domain), 3 "Or:" alternatives. Actions: accept (signal `accept` + move), file into another (signal `reject` for the skipped suggestion + `move`), kill (signal `kill` + trash), skip/Later (signal `later` + "Skipped for now" with Undo). Every action has Undo.
- `TriageView` (S14): title + "{i} of {total}", Done, lime progress bar, "✦ Looks like **{collection}**" pill, `SwipeCardStack` (right stamp = collection name, left = TRASH; right with no suggestion opens the Move sheet), card (hero, "domain · meta · saved from {source}", title, excerpt, tags), "Or:" chips, bottom row (ink trash circle · glass Later · signal **{collection} →** / **Choose a collection**), done state ("Unsorted is clear" + Back to library).
- Entry points: Library banner, Collections Unsorted card, Unsorted collection button (from earlier phases).
- `SwipeCardStack` gets `showsButtons`; the back card renders blank so its text doesn't show through the translucent front card.
- Tests: heuristic on fixtures (rust → Rust & async ✅, space → Reading ✅, home → Home, none for #apple), queue/progress, every action has Undo + logs a signal ✅ (via a recording API spy), Undo restores queue order. UI test: banner → Later → Trash → Undo. 114 package tests, 13 UI tests.

### Not done
- None.

### Spec conflicts
- None.

### `// BACKEND:` items
- (Spec) a server-side suggestion per inbox link, later.

### Check by hand
- Swipe the card right/left with VoiceOver on: the named actions are the collection name and "Trash".

---

## Phase 10 · Onboarding & import

**Status:** Done

### Done
- **Parsers** (`ImportParsers`, Store): a straight port of the web app's `src/lib/import/parse.ts` — Netscape bookmark HTML (folder trail via `<H3>`/`</DL>` stack, entities, `ADD_DATE` → ISO, non-web hrefs dropped, title fallback `titleFromURL`), Telegram `result.json` (Saved Messages or full export, `link`/`url`/`text_link` entities, message text as context ≤ 500, first sentence as title), dispatch by extension, merge (first URL wins, max 5,000), error cases. All web `parse.test.ts` cases ported ✅, plus synthetic samples in `Fixtures` (`sample-bookmarks.html`: 25 links / 4 folders; `sample-telegram.json`: 11 links) with count tests ✅.
- **Models aligned with the backend**: `ImportItem` = `{url, title, source, meta}`; `GroupingPriorities` = `{focus, topics, kept, killed, avoid}`; `LinkCheckEvent` decodes `dead` as a count (`progress`) or a list (`done`).
- **MockAPI**: `importLinks` (dedupes against the library, skipped count), `checkImportedLinks` (600 per request + `remaining`, deterministic statuses, ~3 s for a 1,284-link run ✅), `groupInbox` (port of the web `groupByMetadata` fallback: deepest folder / Telegram context, else domain; groups of 3+; respects "avoid").
- **`OnboardingModel`**: files per source with spec error copy, merged count, import (+ failure copy), resumable check loop, Gone/Parked/No answer groups (status 404·410 / 1 / 0) with default selection, trash selected, 8-card sample round-robin across domains, keep/bin with `keep`/`kill` signals (bin → Trash), suggestion chips from folders + domains, grouping, result binning → `dissolve` (links back to Unsorted, Undo) with signals.
- **UI**: `WelcomeView` (S1; demo card floats unless Reduce Motion; Mock Apple sign-in; email sheet → "Check your inbox…"), `OnboardingFlow` (S2–S5: header indicator + Skip, source cards with steps / chosen strip / errors, `fileImporter` with security-scoped reads, Clean ring + glass pill + selectable groups, Keep or bin stack + 64-pt buttons, the two questions with chips, grouping wait, result cards with `KeepBinSegment` and the glass footer).
- **Gating**: signed out → Welcome; first sign-in with an empty library → onboarding; "Import links" (Collections) and the empty-state row re-enter it. Settings Sign out → Welcome; Delete account → clears and signs out. UI tests run signed in; `-welcome` / `-onboarding` open those screens. A DEBUG "Load sample exports" button feeds the fixtures.
- `.alPrimary` / `.alSignal` dim when disabled.
- Tests: 128 package tests; UI tests `testWelcomeSignsInWithMockAuth` ✅ and `testOnboardingEndToEndOnMock` ✅ (~27 s, gate < 2 min). 15 UI tests total.

### Not done
- Clean step resume banner on next launch (the check itself is resumable; the banner isn't built).
- "Review all" dead-link list (optional in S3).
- Real Sign in with Apple / magic link: phase 11.

### Spec conflicts
- `05` §2 models `LinkCheckEvent.dead` as `[DeadLink]`; the backend sends a count on `progress` and the list on `done`. Decoding handles both.
- `ImportItem` / `GroupingPriorities` shapes in `05` didn't match the backend (`ImportedLink`, `Priorities`); the models now follow the backend.

### `// BACKEND:` items
- Supabase Apple sign-in and magic link (`WelcomeView`).

### Check by hand
- AirDrop a real Chrome export and a Telegram `result.json` to the simulator / device and import both.
