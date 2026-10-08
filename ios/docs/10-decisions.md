# 10 · Decision log

Record new decisions at the bottom, in the same format. Claude Code: when you resolve a conflict between the spec
and these docs, or between the docs and the SDK, add an entry here.

| # | Decision | Why | Overrides |
|---|---|---|---|
| D1 | Build **version B** of the design (capture-first, native-forward). | Chosen after the A/B design review. | — |
| D2 | Tabs: Library · Collections · Search (`role: .search`). No List/Grid tab, no FAB. | Tabs are places, not settings; the iOS 26 search tab is the native pattern. | spec/01 §9.6 (web tab bar) |
| D3 | Add lives in `.tabViewBottomAccessory` (Paste capsule), not a toolbar "+". | Capture is the product's main verb; one tap from every tab, and the clipboard state is visible without the paste alert. | spec/02 §2.2 option "toolbar +" |
| D4 | SF Pro for system chrome; Instrument Sans for content and brand. | Native controls read as native; the brand stays in titles and cards. | spec/01 §2 ("Instrument Sans everywhere") |
| D5 | Tiles 184 pt tall with a 92 pt hero (spec: 124 / 54). | A 54 pt hero shows almost nothing on a phone, and most imported links have no image, so the identity fallback needs room. | spec/01 §9.2 |
| D6 | Rows are 64 pt, two lines with a thumbnail (spec: 44 pt, one line). | Domain and reading time are what people scan for. | spec/01 §9.3 |
| D7 | Reader body text 17 pt (spec: 15). | 15 is a web size; long reading on iPhone wants the system body size. | spec/01 §2.3 |
| D8 | Multi-select uses a native glass bottom toolbar, not the dark capsule bulk bar. | The capsule doesn't fit 402 pt without truncation; the features spec asks for a bottom toolbar. | spec/01 §9.11 |
| D9 | Card size S/M/L is hidden on iPhone (still synced, default M). | No visual effect on iPhone. | spec/02 §4.3 (suggested) |
| D10 | Default destination is **Unsorted**; a suggested collection is shown, never auto-selected. | The shipped behaviour; avoids silent mis-filing. | Mockup 4d ("Reading") |
| D11 | The share extension saves immediately; edits are optional afterwards. | Principle 1; the extension's memory limits. | spec/02 §4.1 (compact form first) |
| D12 | **Sort Unsorted** triage screen added (not in the web app). | The inbox fills from imports and shares; reuses the Keep/Bin gesture; feeds `user_signals`. | — |
| D13 | Destructive single-item *Delete forever* in Trash asks for confirmation (web: no confirm). | Principle 2 ("nothing is deleted outright"); it's the only irreversible single tap. | spec/02 §4.13 |
| D14 | Suggested collections are created as **filters** (smart collections, `#tag`), labelled "Make “X” a filter?". | Matches web behaviour (Create saves a smart collection); "filter" is the honest name. | — |
| D15 | Collection markers are circles. | Shipped web app. | Mockup squares |
| D16 | The XcodeGen-generated project is not committed. | Avoids merge conflicts; agents edit `project.yml`. | — |
| D17 | Video tiles show "▶ Video" until the API returns a duration. | The model has no duration field (`05` § Gaps). | prototype "▶ 48:12" |

## Open questions (ask the owner before the phase that needs them)

1. **Bundle id, team, App Group and web domain** for universal links: needed in phase 0 for device builds and in phase 13.
2. **Backend timeline** for auth and REST endpoints: phase 11 blocks on it. Who owns `DELETE /api/account`?
3. **Mid-crawl save on the server** (enrichment keyed by link id): needed for the B share extension to be complete.
4. Should **archived links** get Unarchive in v1? That needs an endpoint.
5. **Analytics:** none planned; confirm. `user_signals` is the only telemetry.
6. Should the app ship **localised** (Ukrainian / Russian) at v1, or English first?
| D18 | `SFSafariViewController` keeps the system control tint (no `preferredControlTintColor`). | Deprecated in iOS 26: tinting interferes with the system's background effects. The SDK wins (`07` header). | `07` § Open original |
| D19 | `AnyLinkAPI.crawl`/`checkImportedLinks` are `async`. | The `MockAPI` actor can't satisfy a sync requirement safely; `@preconcurrency` trapped at runtime when called through `any AnyLinkAPI`. | `05` §2 signatures |
| D20 | `PasteButton` uses `payloadType: String` and extracts the first http(s) URL. | A `URL` payload stays disabled when the clipboard holds a link as plain text (Notes, Messages). | `07` § Clipboard, S8 |
| D21 | The offline cache stores the library snapshot and the outbox as JSON blobs in SwiftData (`CacheBlob`), not per-link `@Model` mirrors. | One upsert per save, no schema migration as models move; views never see SwiftData types either way. | `02` § Persistence (`CachedLink`/`CachedCollection`) |
| D22 | Auth stays on the shared `API_TOKEN`; Supabase sign-in is not wired. | The backend only verifies the shared token today (`05` §3). Signing in to Supabase without a backend that checks the JWT would be theatre. Welcome uses Mock auth. | phase 11 `AuthService` | **Superseded:** Supabase Auth shipped (`05` §3).
| D23 | Secondary text alphas raised: `Ink.a45/a50` → .72, `a55` → .72, `a60/a65` → .74, `a75` → .76; Settings and list section headers use them instead of the system grey; destructive text uses a darker red (`AL.destructiveText`); the toast's Undo is dark on the light (dark-mode) toast. | WCAG 4.5:1 for small text over the orbs and glass; the accessibility audit is a phase-13 gate. | `03` §1 ink alphas, `03` §6 Toast |
| D24 | Every fixed `.font(.system(size:))` became the nearest text style (11 → `.caption2`, 12 → `.caption`, 13 → `.footnote`, 14–15 → `.subheadline`, …); tiles/cards/buttons use minimum heights. | Dynamic Type everywhere (CLAUDE.md rule); fixed heights clipped grown text. | `03` §6 exact pt sizes |
| D25 | UX pass simplifications: one Save in the add sheet ("Save now" mid-crawl, "Save to {collection}" after); Paste only when the clipboard has a link, otherwise the URL field is focused; no Highlight toolbar button in the reader (the edit menu has it); detail ⋯ menus drop Open/Share/Move (already on screen); the Why card drops Rename (it's in ⋯); no Done on Sort Unsorted (back does it); no dashed New collection card (toolbar +); "Delete empty collections" only when one is empty; Settings "Share sheet" row → section footer; no `SortTip`; Import's single exit is "Not now" when the library has links (no Skip). | Every removed control duplicated another on the same screen, or did nothing useful (a toast, a disabled button). Owner asked for a UX simplification pass. | `04` S8, S10, S11, S14, S15, S17, S18; `07` TipKit table |
| D26 | The paste accessory is hidden on Search and Trash; with nothing on the clipboard the whole bar opens the add sheet. | Search's main action is its field; Trash has nothing to paste into. Only the small "New" pill used to respond to taps. | `04` S6 accessory |
| D27 | Trash rows show a visible Restore button; link counts are pluralised ("1 link"). | Restore was swipe-only; "1 links" read as a bug. | `04` S17 |
