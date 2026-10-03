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
