# 02 · Architecture

## Targets

| Target | Type | Bundle id (placeholder, change once) | Notes |
|---|---|---|---|
| `AnyLink` | iOS app | `com.shaggspeare.anylink` | iOS 26.0, iPhone (iPad allowed, phone layout until phase 14) |
| `AnyLinkShare` | Share extension | `com.shaggspeare.anylink.share` | SwiftUI inside `UIHostingController` |
| `AnyLinkUITests` | UI tests | — | Launch argument `-ui-testing` switches to `MockAPI` |
| `AnyLinkKit` | Local Swift package | — | All logic and shared UI. Linked by the app and the extension |

Shared capabilities:

- **App Group** `group.com.shaggspeare.anylink`: SwiftData store and settings shared with the extension.
- **Keychain Sharing** group `$(AppIdentifierPrefix)com.shaggspeare.anylink.shared`: auth session.
- **Associated Domains** (phase 13): `applinks:<web domain>`.
- **Sign in with Apple**.
- **iCloud** (app only): CloudKit container `iCloud.com.shaggspeare.anylink` for the local library, plus push
  (`aps-environment`) and the remote-notification background mode, so CloudKit can tell the app about changes.
- **App Attest** (app only): signs the server calls a local library makes (`05` §3).

## Package modules (`Packages/AnyLinkKit`)

```
Models          ← no dependencies
QueryLanguage   ← Models
DesignSystem    ← Models (for identity colours)            SwiftUI
Networking      ← Models                                     Foundation only
Persistence     ← Models                                     SwiftData
Store           ← Models, QueryLanguage, Networking, Persistence
Fixtures        ← Models, Networking (MockAPI data)          resources: library.json, crawl-*.ndjson
```

Each module has a `…Tests` target using **Swift Testing** (`import Testing`, `@Test`, `#expect`).
The app target contains screens and navigation only. If a screen needs logic beyond formatting, that logic goes in
the package, either on `LibraryStore` or in a small screen model.

## State

### `LibraryStore` (`@Observable @MainActor final class`)

The single source of truth for library data in the UI.

```swift
@Observable @MainActor
final class LibraryStore {
    private(set) var links: [LinkItem.ID: LinkItem]
    private(set) var order: [LinkItem.ID]          // newest first unless the user sorts by "My order"
    private(set) var collections: [LinkCollection]
    private(set) var syncState: SyncState          // .idle, .syncing, .failed(AppError), .offline
    var clipboardHasURL: Bool                      // fed by ClipboardWatcher

    // Derived (computed, never stored)
    func links(matching query: Query) -> [LinkItem]
    var live: [LinkItem]                            // !deleted && !archived
    var trash: [LinkItem]
    func count(in collectionID: LinkCollection.ID) -> Int
    func suggestedCollection(for link: LinkItem) -> LinkCollection?   // triage
    var suggestedFilter: SuggestedFilter?           // tag on ≥3 live links that isn't a collection or filter

    // Intents: optimistic, then call the API, roll back and show a toast on failure
    func save(_ draft: LinkDraft) async -> LinkItem
    func move(_ ids: Set<LinkItem.ID>, to: LinkCollection.ID)
    func setFavorite(_ id: LinkItem.ID, _ on: Bool)
    func setNote(_ id: LinkItem.ID, _ text: String)
    func addHighlight(_ id: LinkItem.ID, quote: String)
    func tag(_ ids: Set<LinkItem.ID>, _ tag: String)
    func archive(_ ids: Set<LinkItem.ID>)
    func trash(_ ids: Set<LinkItem.ID>)             // registers Undo
    func restore(_ ids: Set<LinkItem.ID>)
    func purge(_ ids: Set<LinkItem.ID>)             // final; the caller has already confirmed
    func createCollection(name: String, color: CollectionColor) -> LinkCollection
    func rename(_ id: LinkCollection.ID, to: String)
    func dissolve(_ id: LinkCollection.ID)          // links → Unsorted, registers Undo
    func createFilter(name: String, query: String)
    func refresh() async                            // full library fetch, then merge
}
```

Rules:

- Every mutating intent returns synchronously after updating local state, then runs the API call in a `Task`.
  On failure it reverts, sets a toast ("Couldn't move the link. Check your connection and try again.") and logs.
- Destructive intents call `UndoCenter.register(label:undo:)`. `UndoCenter` drives both the toast's Undo button and
  `UndoManager` (shake to undo).
- `SignalLogger.log(.move, linkIDs:…)` is called fire-and-forget for accept/reject/move/keep/kill/calibrate
  (`spec/02` §3.1). It never blocks and never surfaces errors.

### Screen-level models

Use a small `@Observable` model only when a screen has state that doesn't belong in the library:

- `AddLinkModel`: crawl session, draft fields, the per-field `edited` flags.
- `OnboardingModel`: import, clean, calibrate and grouping steps.
- `SearchModel`: text, tokens, results.
- `TriageModel`: queue and progress.

Everything else reads `LibraryStore` directly from the environment.

### Environment

```swift
@main struct AnyLinkApp: App {
    @State private var env = AppEnvironment.live()   // .mock() under -ui-testing and in previews
    var body: some Scene {
        WindowGroup { RootView().environment(env.store).environment(env.router).environment(env.toasts) }
            .modelContainer(env.modelContainer)
    }
}
```

`AppEnvironment` builds `LiveAPI`, `LocalAPI` or `MockAPI`, the `AuthService`, the `ModelContainer` (App Group URL)
and the `LibraryStore`. `AppEnvironment.make(_ mode: LibraryMode)` picks: `.server` → `live()` (or `mock()` without a
backend or under `-ui-testing`), `.local` → `local()`.

## Navigation

```
RootView             no sign-in wall: a new install opens its local library
├─ WelcomeView       Settings → Sign in, as a sheet (router.sheet = .signIn)
├─ OnboardingFlow    first launch or "Import links" → fullScreenCover, NavigationStack of steps
└─ MainTabs          TabView (Liquid Glass) + .tabBarMinimizeBehavior(.onScrollDown) + .tabViewBottomAccessory
    ├─ Tab "Library"      NavigationStack(path: $router.library)
    ├─ Tab "Collections"  NavigationStack(path: $router.collections)
    └─ Tab(role: .search) NavigationStack(path: $router.search)
Sheets (router.sheet): .addLink(prefill: URL?), .moveLinks(Set<ID>), .tagLinks(Set<ID>), .newCollection, .rename(ID)
Dialogs: .confirmationDialog driven by router.confirm (trash n, dissolve, empty trash, delete forever, delete account)
Toasts: ToastCenter overlay above the tab bar (one at a time, 5 s, optional Undo)
```

```swift
enum Route: Hashable {
    case link(LinkItem.ID)                 // reader or product, chosen by contentType
    case collection(LinkCollection.ID)
    case filter(Query, title: String)      // built-in filter, tag, custom filter or "show all matches"
    case triage
    case trash
    case settings
}
```

- `Router` is `@Observable @MainActor`. It owns one `[Route]` path per tab, the selected tab, the active sheet,
  the confirm dialog and `isSelecting`.
- Tapping the active tab pops to the root; tapping it again scrolls to the top.
- Deep links (`anylink://add?url=`, universal links `/links/{id}`) resolve through `Router.handle(_ url:)`.
- The tab bar and accessory are hidden on `.link`, `.triage` and `.settings`. Those screens have their own bottom
  toolbar or none.

## Networking

- `protocol AnyLinkAPI: Sendable`, with one async method per endpoint (`05-data-and-api.md`).
- `LiveAPI` uses `URLSession` with the bearer token from `AuthService`. On 401 it refreshes the token once, then
  signs out.
- `MockAPI` (an actor) serves `Fixtures`, adds 150–400 ms of latency, can be told to fail, and replays the recorded
  crawl streams with timing.
- Crawl: `func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error>` reads
  `URLSession.bytes(for:)` → `.lines` → decodes `CrawlEvent`. If the stream ends without
  preview/done/failed, it yields `.failed(.network)`.

## Persistence

Two SwiftData stores in the App Group container, both owned by `Persistence`. Views never see `@Model` types.

- **Which library**: `LibraryMode(signedIn:plan:)` in Store. Signed in with Pro → the server library. Anything else
  (signed out, or signed in on Free) → the local library (ADR 0002, D28). `AppEnvironment.make(_:)` builds the
  environment for a mode; RootView swaps it when the mode changes.
- **Upgrade and lapse** (`LibraryMove` in Store, run by RootView, D29). The stored `plan` is the plan of the library
  on screen, so it changes only once a move has finished.
  - Upgrade: signed in on a local library, the server says Pro (after a purchase, a sign-in, or any return to the
    app). `LibraryMove.upgrade` sends the local library through `uploadLibrary` in batches (200 links or about 3 MB,
    an image on its own) and keeps the ids that arrived in `UserDefaults`, per account, so it resumes after a kill or
    a failure. Then RootView switches to the server library. `Local.store` is left as it was.
  - Lapse: on the server library, a refresh says `plan: free`. `LibraryMove.lapse` copies the server library into
    `Local.store` with `LibraryRules.union` (match by id, `clientId`, then URL; the server's copy wins a match; nothing
    is deleted), forgets the upload record so going Pro again sends everything, and RootView switches to the local
    library, still signed in.
- **Server library cache** (`LocalCache`, `AnyLink.store`, D21): the last library snapshot and the outbox as JSON
  blobs (`CacheBlob`). Launch loads it into `LibraryStore` (instant UI), then `refresh()`.
- **Local library** (`LocalStore`, `Local.store`, D28): the free library itself, mirrored to the user's private
  CloudKit database.
  - One `LinkRecord` per link and one `CollectionRecord` per collection. Each holds the `Models` value as JSON, plus
    `id` and `updatedAt`. An image item's bytes sit in `.externalStorage`, so they sync as an asset.
  - CloudKit's rules: every property has a default, nothing is `.unique`, and there are no relationships.
  - Writes upsert by `id`, one record per item. Reads keep the newest copy if two devices made the same id.
  - `LocalAPI` (Store) implements `AnyLinkAPI` over it, so `LibraryStore` works the same in both modes. Creating
    collections and filters works offline. Sharing, price alerts and export answer `.proRequired`.
  - `LibraryStore.refresh()` re-reads it at launch, whenever the app becomes active, after a background crawl fills
    in a link, and when `LocalStore.remoteChanges()` reports a CloudKit import (persistent history: a save by
    another author).
  - `LocalCache` opts out of CloudKit (`cloudKitDatabase: .none`): with the iCloud entitlement, SwiftData would
    otherwise try to sync it too.
- **Shared with the extension**: `AnyLink.store` also holds the `PendingSave`s and the recent collections, in both
  modes. The extension never opens `Local.store`. The App Group defaults key `serverLibrary` tells it which mode the
  app is in: a server library saves through the API; a local one always leaves a `PendingSave`.
- The app drains pending saves on launch and on `scenePhase == .active`. In a local library, a save with no page data
  (share extension, Shortcuts) is filed at once and read in the background, as the server's `fillFromPage` does.

## Concurrency

- Swift 6 strict mode. UI types are `@MainActor`. Models are `Sendable` structs.
  `MockAPI`, `ClipboardWatcher` and `SpotlightIndexer` are actors or `@MainActor` as appropriate.
- No `DispatchQueue` in new code. Use `Task`, `TaskGroup`, `AsyncStream`.
  Cancel crawl tasks when the Add sheet closes.

## Errors

```swift
enum AppError: Error, Equatable { case offline, unauthorized, notFound, server(Int), invalidURL, decoding, unknown }
```

Each case maps to one user-facing sentence in `Localizable.xcstrings` (`error.offline` = "You're offline. Changes are saved and will sync when you're back.").

## Suggested app folder layout

```
AnyLink/
  App/            AnyLinkApp.swift, AppEnvironment.swift, RootView.swift, Router.swift
  Features/
    Onboarding/   WelcomeView, ImportStep, CleanStep, KeepOrBinStep, CollectionsResultStep, OnboardingModel
    Library/      LibraryView, LibraryTilesGrid, LibraryRowsList, ScopeChips, UnsortedBanner, SelectionToolbar
    Link/         ReaderView, ProductView, PriceChart, NoteEditor, HighlightableText, LinkContextMenu
    Capture/      AddLinkSheet, AddLinkModel, PasteAccessory
    Collections/  CollectionsView, CollectionView, FilterResultsView, NewCollectionSheet, TrashView
    Search/       SearchView, SearchModel, SearchResultRow
    Triage/       TriageView, TriageModel
    Settings/     SettingsView
  Shared/         ToastOverlay, ConfirmDialogs, SafariView, ShareLinkButton
  Resources/      Assets.xcassets (AppIcon, colours), Fonts/InstrumentSans*.ttf, Localizable.xcstrings
ShareExtension/   ShareViewController.swift (UIHostingController), ShareView.swift, Info.plist
```
