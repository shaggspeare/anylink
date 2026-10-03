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
