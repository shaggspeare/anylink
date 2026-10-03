# 08 · Build plan

Work **one phase per Claude Code session**, in order. Every phase ends at a **gate**: the acceptance list passes,
`/verify` is green, and a summary is written to `docs/progress.md` (create it in phase 0; append one section per
phase).

The app runs against **MockAPI** until phase 11. Every phase before that should feel like the finished app with
sample data.

---

## Phase 0 · Scaffold

**Read:** `CLAUDE.md`, `02-architecture.md`, `03-design-system.md` §1–2, `templates/project.yml`.

**Tasks:**
1. Copy `templates/project.yml` to the root. Fill in the team ID placeholder from the developer, or leave it empty for simulator builds.
2. Create the folder layout (`02` § Suggested layout) and the `Packages/AnyLinkKit` package with the modules and test targets.
3. `Tokens.swift` (spec §15 + `03` §1 additions) and `Color(hexString:)`.
4. Bundle Instrument Sans; register the fonts; add `AL.Font.brand`. Add a DEBUG log of the PostScript names.
5. `Config.example.xcconfig`, `AppConfig`, `FeatureFlags`.
6. An empty `RootView` showing "AnyLink" in `largeTitle` over `Orbs(.library)`.
7. `Localizable.xcstrings`, the asset catalog with an AppIcon placeholder, and `.gitignore`
   (`*.xcodeproj` is generated, so ignore it).
8. `scripts/verify.sh`: `xcodegen generate`, `swift test --package-path …`, `xcodebuild build`. It must exit
   non-zero on warnings (`-warnings-as-errors` for the app target in CI only).

**Gate:** the app launches in the simulator showing the title in Instrument Sans in light and dark; `swift test`
runs (an empty suite is fine); `verify.sh` passes.

> Prompt: *"Read CLAUDE.md, docs/02-architecture.md and docs/03-design-system.md sections 1–2. Do Phase 0 from docs/08-build-plan.md. Stop at the gate."*

## Phase 1 · Models, fixtures, MockAPI, query language

**Read:** `05-data-and-api.md`, `06-query-language.md`.

**Tasks:**
1. `Models`: the structs from spec §3 with the `05` §1 changes, `CrawlEvent` decoding, and `LinkDraft`.
2. `Fixtures`: load `docs/fixtures/*`, copied into the module's resources by a build phase or by hand. Add a test
   that decodes every fixture.
3. `Networking`: the `AnyLinkAPI` protocol, `MockAPI` (an actor, latency, `failNext`, crawl replay using `_delayMs`)
   and an NDJSON line decoder.
4. `QueryLanguage`: parser, evaluator, `LibraryIndex`, `SearchToken` mapping, and serialisation that round-trips.
5. Tests: every row of the `06` test table, crawl replay ordering, and a 5,000-link performance test (< 16 ms per
   query).

**Gate:** `swift test` green; 100 % of the query-table rows covered.

## Phase 2 · Design system components + Gallery

**Read:** `03-design-system.md` (all of it).

**Tasks:** `Frosted`, `Orbs`, `HeroFallback`, `HeroImage` + `ImageLoader`, `InitialBadge`, `LinkTile`, `LinkRow`,
`ScopeChip`, `UnsortedBanner`, `PasteAccessory` (UI only), `Toast` + `ToastCenter`, `CollectionCard`, `WhyCard`,
`SwipeCardStack`, `KeepBinSegment`, the button styles, `Field`, `Notice`, and the `alShadow` modifier.

Add a DEBUG-only `GalleryView`, reachable with a launch argument `-gallery`, that shows every component in every
state.

**Gate:** each component has light and dark previews, a Reduce Transparency preview where relevant, and a large
Dynamic Type preview. The swipe stack works with buttons and VoiceOver actions.

## Phase 3 · App shell

**Read:** `02-architecture.md` § State, Navigation; `07-ios-native.md` § Tabs, Clipboard, Undo.

**Tasks:**
1. `AppEnvironment` (`.mock()` / `.live()`), `LibraryStore` with all its intents (optimistic + rollback),
   `UndoCenter`, `ToastCenter`, `SignalLogger`.
2. `Router` with per-tab paths, sheets and confirmations. `MainTabs` with `TabView`, the search tab, minimize on
   scroll, and the accessory.
3. `ClipboardWatcher` (detect patterns), wired to the accessory and `PasteButton`.
4. Placeholder screens for every route.

**Gate:**
- Store tests: every intent; rollback on `failNext`; Undo restores the exact state.
- Tapping the active tab pops to the root.
- The accessory shows the clipboard state without a paste alert (test by copying a URL in Safari on the simulator).

## Phase 4 · Library

**Read:** `04-screens.md` S6, S7.

**Tasks:** `LibraryView` (scopes, banner, tiles and rows, sort menu, entrance animation, pull to refresh,
skeleton, empty state); the context menu; swipe actions; select mode + bottom toolbar + Move/Tag sheets + Trash
confirmation; toasts with Undo.

**Gate:** every S6 state has a preview. The UI test `testTrashAndUndoFromContextMenu` passes. VoiceOver reads a
tile as one element with 4 rotor actions.

## Phase 5 · Capture (Add sheet)

**Read:** `04-screens.md` S8, `07-ios-native.md` § Add sheet streaming, `05` § Crawl stream.

**Tasks:** `AddLinkModel` (steps, edited flags, cancel), `AddLinkSheet` (idle medium → large: crawling, ready,
excerpt-only, failed), suggested tags, collection chips, save and save-now, `anylink://add?url=`.

Also implement `LiveAPI.crawl` now, against `ANYLINK_API_BASE`: `/api/crawl` already exists, so test it for real if
a URL is configured.

**Gate:**
- Unit test: a title edited during refining survives `done`.
- UI tests run all three Mock streams.
- Cancel stops the network task (assert on MockAPI).

## Phase 6 · Link detail

**Read:** `04-screens.md` S15, S16; `07` § Reader highlights, Charts, Open original.

**Tasks:** `ReaderView` (stretchy hero, chips, note editing, `HighlightableText`, excerpt fallback rule, video
variant, "Also in", bottom toolbar, Safari view); `ProductView` (chart with range, threshold rule, alert field,
specs, flagged push toggle).

**Gate:**
- The < 40 words-of-prose rule is unit-tested.
- Highlight added through the edit menu.
- The chart hides with < 2 snapshots.
- `% since saved` is computed and hidden when ≤ 0.

## Phase 7 · Collections, filters, Trash, Settings

**Read:** `04-screens.md` S10, S11, S12, S17, S18.

**Tasks:** `CollectionsView` (filters, suggested filter, Unsorted card, grid, custom filters, tags, quiet rows),
`NewCollectionSheet` / Rename, `CollectionView` (WhyCard Keep/Rename/Dissolve, tag chips, rows),
`FilterResultsView`, `TrashView` (grouped, swipe Restore/Delete, Empty with confirmation), `SettingsView`
(appearance, open-in, clipboard toggle, tips reset, sign out and delete account against Mock).

**Gate:** Dissolve → Undo restores the collection and its links. Delete empty collections reports the count.
Appearance applies app-wide immediately.

## Phase 8 · Search

**Read:** `04-screens.md` S13, `06-query-language.md` § Search tokens, `07` § Search.

**Tasks:** `SearchModel` (debounce, tokens, suggestions, results, match location and snippet), `SearchView`
(empty state, results, collections, Save as filter alert), keyboard submit.

**Gate:** typing `type:video ` turns into a token. Snippet rows appear for summary and note matches. Save as filter
creates a smart collection visible in Collections.

## Phase 9 · Sort Unsorted (triage)

**Read:** `04-screens.md` S14.

**Tasks:** `TriageModel` (queue, Later, progress, suggestion heuristic), `TriageView` (stack, stamps, buttons,
"Or" chips, done state), and the entry points (Library banner, Collections Unsorted card, Unsorted collection
button).

**Gate:** the heuristic is unit-tested on fixtures (rust-tagged → Rust & async; space → Reading). Every action has
Undo and logs a signal.

## Phase 10 · Onboarding & import

**Read:** `04-screens.md` S1–S5, `07` § Onboarding import.

**Tasks:**
- Welcome (Apple button wired to Mock auth); `OnboardingFlow` with Import (fileImporter, both parsers, counts,
  errors), Clean (streamed check, groups), Keep or bin (8 cards), the two free-text questions, grouping wait, and
  the Collections result.
- First-launch gating; "Import links" re-entry from Collections and the empty state.

**Gate:**
- The parsers are tested on real samples. Add a Chrome export and a Telegram `result.json` to `Fixtures`; create
  synthetic ones if none are available.
- The whole flow works end to end on Mock in under 2 minutes.

## Phase 11 · Auth, live API, sync, offline

**Read:** `05-data-and-api.md` §2–4, 6–7.

> **Needs the backend.** If the endpoints aren't live, implement `LiveAPI` against the documented contract with a
> local stub server (a `URLProtocol` stub in tests), leave `// BACKEND:` notes, and keep Mock as the default.

**Tasks:**
- `AuthService` (Supabase: Apple id token, magic link, shared-keychain storage, refresh).
- `LiveAPI` for every method; SwiftData cache; `Outbox`; reachability; merge.
- The 401 → sign-out path.

**Gate:**
- With `URLProtocol` stubs: optimistic intent → network failure → outbox retry → success.
- Cold launch shows the cached library before the network answers.

## Phase 12 · Share Extension

**Read:** `04-screens.md` S9, `07` § Share Extension.

**Tasks:** the extension target in `project.yml`, the activation rule, `ShareViewController` + `ShareView`, instant
save, a status line driven by the crawl, the Move chips, the note, the offline `PendingSave`, and the signed-out
state. The app drains `PendingSave` rows.

**Gate:** sharing a Safari page in the simulator saves it to Unsorted within 1 s (Mock or live). The link appears
in the app after it returns to the foreground. Memory stays under 40 MB in Instruments.

## Phase 13 · Native extras & polish

**Tasks:**
- Spotlight indexing and continuation, `SaveLinkIntent` + `AppShortcutsProvider`, TipKit tips, universal links.
- A haptics pass and a Reduce Motion / Reduce Transparency / Increase Contrast pass.
- Run `performAccessibilityAudit()` in UI tests for every top-level screen.
- App icon (Icon Composer) and launch screen.

**Gate:** zero accessibility-audit failures. A Spotlight result opens the link. "Save to AnyLink" works in
Shortcuts.

## Phase 14 · iPad (later)

`NavigationSplitView` (sidebar = Collections list, content = mosaic, detail = link); the S/M/L mosaic as a custom
`Layout` (spec §10); pointer hover islands; keyboard shortcuts (spec §4.18).
