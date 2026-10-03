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
