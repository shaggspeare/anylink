# AnyLink iOS — to do

Everything still open after phases 0–13 and the UX review pass (2026-10-04). Phase details are in
`08-build-plan.md`. The history behind each item is in `progress.md`, and the decisions referenced (D…) are in `10-decisions.md`.

## Phase 14 · iPad

- [ ] `NavigationSplitView` with three columns: Collections sidebar, link grid, link detail.
- [ ] Mixed small/medium/large tile grid as a custom `Layout` (spec §10).
- [ ] Pointer hover effects on tiles and controls.
- [ ] Keyboard shortcuts (spec §4.18), including ⌘N for a new link.

## Blocked on the backend or an owner decision

- [ ] **Real sign-in**: Sign in with Apple or a magic link via Supabase. Blocked until the backend verifies Supabase JWTs (D22).
  - [ ] Store the token in a keychain shared with the share extension, replacing the build-time `ANYLINK_API_TOKEN`.
- [ ] **Updating a link after "Save now"**: no endpoint exists to PATCH a link's title and excerpt. A link saved before reading finishes keeps only what was known at that moment. `// BACKEND:` in `AddLinkModel.save`.
- [ ] **Delete account**: `DELETE /api/account` doesn't exist yet; App Store guideline 5.1.1(v) requires it. `LiveAPI.deleteAccount` throws 501 for now.
- [ ] **Universal links**: needs the web domain for Associated Domains (open question 1). `Router.handle` already routes `https://…/links/{id}`.
- [ ] **Offline create**: queue `createCollection`, `createFilter` and `save` while offline. They need a temporary id that's swapped for the server's id after sync. Today they fail with the offline toast.
- [ ] Decide whether "Keep" on an AI-made collection should be saved on the server. Today it's remembered on the device only and logged as a signal.

## Small deferred features

- [ ] Drag to reorder links in "My order" (P1).
- [ ] Collection ⋯ menu: "Sort" and "Share list" (P2).
- [ ] Import cleanup step:
  - [ ] A banner on next launch offering to resume the dead-link check.
  - [ ] The optional "Review all" list of dead links.
- [ ] Search: `.searchSuggestions` completions in the search field.
- [ ] Tapping the long-press preview card should open the link. SwiftUI has no hook for this, so it needs UIKit.
- [ ] Highlights: store offsets so a quote that appears more than once highlights the right occurrence.

## Quality

- [ ] **Accessibility audits fail on Search and Trash** with a contrast hit not tied to any element ("SwiftUI.AccessibilityNode"). They also fail on the commit before the UX pass, on the iOS 26.4 simulator. Start with the frosted list-row background the two screens share.
- [ ] Remove the pre-existing Swift 6 isolation warnings in `AnyLinkUITests` (`launch()` and `XCUIScreenshot.image` are used outside the main actor).
- [ ] App icon: replace the placeholder PNG set with a layered Icon Composer icon.
- [ ] `docs/07-ios-native.md`: remove `SortTip` from the TipKit table (removed in D25).

## Check by hand

- [ ] Share extension memory stays under 40 MB (Instruments).
- [ ] Shortcuts → "Save to AnyLink" with a URL → the link lands in Unsorted.
- [ ] Spotlight: search for a saved title → tap it → the reader opens.
- [ ] Settings → Show tips again → relaunch → tips reappear.
