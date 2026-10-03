# 05 · Data, API, auth and sync

## 1. Models (`AnyLinkKit/Sources/Models`)

Copy the Swift structs from `spec/02-features-and-ios-native.md` §3 (`CardSize`, `ContentType`, `LinkStatus`,
`Highlight`, `PriceSnapshot`, `Variant`, `Spec`, `ProductDetails`, `ImportMeta`, `LinkItem`, `LinkCollection`).
Then apply these changes:

- Every type is `Sendable`. IDs get a typealias (`LinkItem.ID = String`).
- `createdAt`: decode ISO 8601 into `Date`, using a custom `JSONDecoder` date strategy that accepts fractional seconds.
- `PriceSnapshot.date` stays `String` (`YYYY-MM-DD`), with a computed `day: Date?`.
- `tint`, `stripe` and `color` stay hex `String`s in the model. `DesignSystem` provides `Color(hexString:)`.
- Add computed helpers in an extension, not stored:
  - `isBroken`: `httpStatus ∈ {0, 1, 404, 410}`
  - `isDuplicate`: requires the library, so it lives on the store
  - `hasNote`
  - `readingMeta`: "6 min read" / "48:12" / price string
  - `retailerShortName`: the first domain label, e.g. "rozetka"
- `LinkDraft`: what the Add sheet and the share extension send:
  `url, title, excerpt, collectionId, tags, size (.M), note, crawl: CrawlResult?`.
- `CrawlResult`, `CrawlFailure`, `CrawlEvent`: copy verbatim from spec §6.1, including the custom `Decodable`.
- `Query`: lives in `QueryLanguage` (`06-query-language.md`).

## 2. API protocol (`Networking`)

The backend lives in this same repo (`../src`). It already serves the web app's functions over HTTP, so
`LiveAPI` maps each method onto an existing endpoint. Full reference: `../docs/ios/03-api.md`.

- `GET /api/v1/library` returns `LibrarySnapshot`.
- `POST /api/v1/actions/<name>` runs the export `<name>` of `../src/lib/db/actions.ts`. The body is the arguments
  as a JSON array, and the response is the return value as JSON (`null` for void). Errors are `{ "error": "…" }`
  with 400, 401 or 404.
- Every `/api/v1` call sends `Authorization: Bearer <API_TOKEN>` (see §3).

```swift
public protocol AnyLinkAPI: Sendable {
    func crawl(_ url: URL) -> AsyncThrowingStream<CrawlEvent, Error>                 // POST /api/crawl (NDJSON)
    func checkImportedLinks() -> AsyncThrowingStream<LinkCheckEvent, Error>           // POST /api/import/check (NDJSON)

    // POST /api/v1/actions/<name> [args…], except library
    func library(since: Date?) async throws -> LibrarySnapshot                        // GET /api/v1/library; `since` ignored, always a full snapshot
    func createLink(_ draft: LinkDraft) async throws -> LinkItem                      // createLink [input], see below
    func updateLink(_ id: LinkItem.ID, _ patch: LinkPatch) async throws               // one call per set field, see below
    func bulk(_ action: BulkAction, ids: [LinkItem.ID]) async throws                  // see BulkAction mapping below
    func reorder(_ ids: [LinkItem.ID]) async throws                                   // reorderLinks [ids]
    func reorderCollections(_ ids: [LinkCollection.ID]) async throws                  // reorderCollections [ids]
    func createCollection(name: String, color: String) async throws -> LinkCollection // createCollection [name, color]
    func createFilter(name: String, query: String) async throws -> LinkCollection     // createSmartCollection [query, name]
    func updateCollection(_ id: LinkCollection.ID, name: String) async throws          // renameCollection [id, name]
    func deleteCollection(_ id: LinkCollection.ID) async throws -> [LinkItem.ID]       // deleteCollection [id] → { trashedIds }; 400 for the inbox
    func deleteEmptyCollections() async throws -> [LinkCollection.ID]                  // deleteEmptyCollections [] → deleted ids
    func addHighlight(_ id: LinkItem.ID, quote: String) async throws                   // addHighlight [id, quote] → null; re-sync to get its id
    func setPriceAlert(_ id: LinkItem.ID, threshold: Double, currency: String) async throws // setAlertThreshold [id, threshold, currency]
    func importLinks(_ items: [ImportItem]) async throws -> ImportResult               // importLinks [items] → { links, skipped }
    func groupInbox(_ priorities: GroupingPriorities) async throws -> [GroupedResult]  // groupInbox [{focus, topics, kept, …}] → [{ collection, linkIds, reasoning }]
    func logSignal(_ signal: Signal) async                                              // logSignal [action, { linkId?, linkIds?, collectionId?, payload? }] (never throws)
    func deleteAccount() async throws                                                   // BACKEND: no endpoint yet; Mock only
}

public enum BulkAction: Sendable { case move(to: LinkCollection.ID), tag(String), archive, trash, restore, purge }
// move → moveLinks [ids, collectionId] · tag → tagLinks [ids, tag] · archive → archiveLinks [ids]
// trash → deleteLinks [ids] · restore → restoreLinks [ids] · purge → purgeLinks [ids]

public struct LinkPatch: Sendable { var note: String?; var favorite: Bool?; var size: CardSize?; var collectionId: String? }
// note → setNote [id, note] · favorite → setFavorite [id, bool] · size → setLinkSize [id, size]
// collectionId → moveLinks [[id], collectionId]. Editing title/excerpt has no endpoint yet (BACKEND:).

public struct LibrarySnapshot: Sendable, Decodable { let links: [LinkItem]; let trashed: [LinkItem]; let collections: [LinkCollection] }
```

**`createLink` input** is built from the crawl result, the same way the web app does it
(`../src/components/add-link-flow.tsx`, `handleSave`): `url` = `canonicalUrl` (or the typed URL if the crawl
failed), plus `domain, title, excerpt, articleText, heroImage, tint, stripe, initial, contentType`
(`"article"` if the crawl failed), `readingTimeMinutes, collectionId, tags, size, product`. A failed crawl still
carries `domain/tint/stripe/initial`. The response is the saved `LinkItem`.

### Crawl stream

```swift
var req = URLRequest(url: base.appending(path: "api/crawl")); req.httpMethod = "POST"
req.setValue("application/json", forHTTPHeaderField: "Content-Type")
req.httpBody = try JSONEncoder().encode(["url": url.absoluteString])
let (bytes, response) = try await session.bytes(for: req)
// 400 → .failed(reason: "invalid-url"). Otherwise, for try await line in bytes.lines → decode CrawlEvent, yield.
// If the stream ends without .preview/.done/.failed → yield .failed(CrawlFailure(reason: "network")).
```

The route can take up to 60 s; use a 70 s timeout. Map `step` events to progress: fetch = 0, parse = 1, tags = 2,
and 3 once `done` arrives.

### Errors

| HTTP | AppError | UI |
|---|---|---|
| no connection | `.offline` | Optimistic change kept and queued; banner "You're offline…" |
| 401 | `.unauthorized` | Refresh the token once, then sign out → Welcome |
| 404 | `.notFound` | Drop the local item, toast `error.generic` |
| 5xx | `.server(code)` | Roll back, toast `error.generic` |

### Images

`heroImage` is either the original site URL or a public WebP. Use one shared `ImageLoader` with a URLCache-backed
memory and disk cache. iOS decodes WebP natively. Downsample to the display size; `AsyncImage` alone isn't enough
for grids.

## 3. Auth

**Today:** the backend is single-user (`CURRENT_USER_ID`). The `/api/v1` routes accept one shared secret,
`Authorization: Bearer <API_TOKEN>`. iOS reads it from `Config.xcconfig` (`ANYLINK_API_TOKEN`) and keeps it in the
shared keychain so the share extension can use it. `AuthService` is a stub that returns this token until the plan
below ships. Note: `/api/crawl` and `/api/import/check` don't check the token yet.

**Plan** for multi-user, needed before the App Store:

- **Supabase Auth** with the **Sign in with Apple** provider, plus email magic links.
- Every API route reads the user from the bearer JWT, and RLS policies on all tables use `auth.uid() = user_id`.

iOS:

```swift
actor AuthService {
    func signInWithApple(idToken: String, nonce: String) async throws -> Session   // supabase.auth.signInWithIdToken(.apple…)
    func sendMagicLink(to email: String) async throws
    func handle(url: URL) async throws                                             // magic-link callback (universal link)
    var accessToken: String { get async throws }                                  // refreshes when needed
    func signOut() async
}
```

- Store the Supabase session in the **shared keychain** (custom `AuthLocalStorage`) so the share extension can read it.
- `SignInWithAppleButton` → nonce (SHA-256) → `idToken` → `signInWithIdToken`.
- Account deletion calls `DELETE /api/account`, which the backend must implement (App Store guideline 5.1.1(v)).

## 4. Sync and offline

1. Launch: load SwiftData into the store (instant), then `library(since: lastSync)`. Use full sync until `since`
   exists.
2. Merge by `id`; the server wins, except for fields with a pending local mutation (an `outbox` queue).
3. `Outbox`: SwiftData table of `{id, kind, payload, createdAt, attempts}`. It drains in order on reachability, on
   app active and after each intent. Retries back off exponentially up to 5 times, then surface a toast.
4. Pull to refresh = sync now. Use `BGAppRefreshTask` later (P2).
5. Spotlight: after each sync, index the changed links (`07-ios-native.md`).

## 5. MockAPI and fixtures

- `Fixtures` loads `docs/fixtures/library.json` (copied into the module's resources) and the
  `crawl-success.ndjson`, `crawl-excerpt-only.ndjson` and `crawl-failed.ndjson` streams.
- MockAPI behaviour:
  - Keeps an in-memory copy and mutates it on calls.
  - Adds 150–400 ms latency (0 in previews).
  - `crawl` picks a stream by URL:
    - a host containing `blocked` → excerpt-only;
    - a host containing `dead` or `404` → failed;
    - otherwise success, with the domain and title rewritten from the URL.
    It replays events with the recorded delays.
  - `failNext(_ error: AppError)` makes the next call fail, for tests.
- Each NDJSON fixture line carries a `_delayMs` field (the wait before that event). MockAPI sleeps for it and ignores the field when decoding.
- `AppEnvironment.mock()` is used by previews, by UI tests (`-ui-testing`) and by DEBUG builds when
  `ANYLINK_API_BASE` is unset.

## 6. Configuration

`Config.xcconfig` (not committed; `Config.example.xcconfig` is committed):

```
ANYLINK_API_BASE = https:/$()/anylink.example.com
ANYLINK_API_TOKEN = …
SUPABASE_URL = https:/$()/xxxx.supabase.co
SUPABASE_ANON_KEY = …
```

These are exposed through Info.plist keys and read by `AppConfig`. A missing value in DEBUG means MockAPI. In
Release it is a fatal configuration error.

## 7. Backend gaps: what the app does meanwhile

| Gap (spec §7 / §6.2) | iOS behaviour now | Needed from backend |
|---|---|---|
| Accounts and auth | Shared `API_TOKEN` against the live API; Mock otherwise | Supabase Auth + RLS + per-user JWT |
| Edit title/excerpt, `library(since:)` | Not editable; full snapshot on each sync | An update action; a `since` filter |
| Save mid-crawl / share-extension save before enrichment | App keeps the stream alive and PATCHes on `done` | Server-side enrichment job keyed by link id |
| Enrichment of imported links | "Plain" cards with HeroFallback, no excerpt | Backfill job |
| Price-drop push | Toggle hidden (`FeatureFlags.pricePush = false`) | Compare and send APNs; device-token endpoint |
| "% since saved" | Computed from `priceHistory.first` vs last | — (fine) |
| Unarchive | Archived filter is read-only | `bulk(restoreArchive)` |
| Delete/annotate highlights | Add only | Endpoints |
| Triage suggestions | Local tag-overlap heuristic | Per-link suggested collection |
| Delete account | Button calls Mock | `DELETE /api/account` |
| Video duration (B tiles show "▶ 48:12") | Show "▶ Video" | `durationSeconds` on video crawl results (YouTube/Vimeo JSON-LD has it) |
