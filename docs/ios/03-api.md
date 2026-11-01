# Backend API for the iOS app

The Next.js app is the only backend. The web UI calls it through server actions, and the iOS app calls the same functions over HTTP, so the two can't drift apart.

Every `/api/v1` request needs `Authorization: Bearer <Supabase access token>` for the signed-in user; without one the API returns 401. Every action runs as that user.

| Endpoint | What it does |
|---|---|
| `GET /api/v1/library` | `{ links, trashed, collections }`. Shapes are `LinkItem` / `Collection` in `src/lib/types.ts`. |
| `POST /api/v1/actions/<name>` | Calls any export of `src/lib/db/actions.ts`. The body is the arguments as a JSON array, and the response is the return value as JSON (`null` for void). |
| `POST /api/crawl` | `{ url }` → NDJSON stream of `step` / `preview` / `done` / `failed` lines. Feed `done.result` into `createLink`. |
| `POST /api/import/check` | NDJSON link-health check after an import. |

Examples:

```
POST /api/v1/actions/moveLinks         [["<linkId>"], "<collectionId>"]
POST /api/v1/actions/setFavorite       ["<linkId>", true]
POST /api/v1/actions/setPinned         ["<linkId>", true]
POST /api/v1/actions/createCollection  ["Reading", "#7c8cff", "📚"]   (icon optional: an emoji or null)
POST /api/v1/actions/createLink        [{ ...LinkItem fields minus id/createdAt/status/archived/highlights }]
```

Errors come back as `{ "error": "..." }` with status 400, 401, or 404.

### Link pinning

`LinkItem.pinned` is a boolean (optional when decoding older snapshots). `setPinned`
returns `{ "ok": true }` on success or `{ "ok": false }` when two live links are
already pinned. The limit is per library, across all collections. Calls are serialized
per user in a database transaction so concurrent web/iOS requests respect the limit.
Pinned links precede unpinned links in every sort order. Archive and Trash clear the
pin; restoring a link does not repin it. iOS queues offline pin changes and removes a
rejected pin if another device has filled both slots before it syncs.

Apply `supabase/migrations/20261004000000_link_pinning.sql` before running the updated
backend. Existing links default to unpinned.

### Shared collections

A shared collection can be read by anyone holding its share link, `https://www.anylink.space/s/<token>`. See `docs/adr/0001-shared-collections-public-by-token.md`.

| Call | What it does |
|---|---|
| `POST /api/v1/actions/setCollectionShared ["<collectionId>", true]` | Returns `{ "shareToken": "..." }`. Turning sharing on again while it's already on keeps the existing token. `false` returns `{ "shareToken": null }` and the old link stops working for good; turning sharing back on later makes a new link. The Inbox and smart collections can't be shared (400). |
| `POST /api/v1/actions/setDisplayName ["Sam"]` | Returns the stored name, or `null` when the name is blank. The name is shown as "shared by Sam". |
| `GET /api/v1/shared/<token>` | **No auth.** Returns `SharedCollection` (`src/lib/types.ts`): `{ name, color, icon?, ownerName?, links }`. `links` are `LinkItem`s with only the fields a viewer may see: no tags, highlights, favourite, article text or price history. They are already in the owner's order (pinned first). Returns 404 once sharing is off. |
| `POST /api/v1/actions/saveFromShare ["<token>", ["<linkId>"]]` | Copies those links into the caller's Inbox. Pass `null` instead of the list to copy the whole collection into a new collection with the same name, colour and icon. Returns `{ links, collection? }`. Copies keep the crawled data and the current price, but not the owner's note. |

`Collection.shareToken` is set while a collection is shared. `GET /api/v1/library` now also returns `displayName`.

Apply `supabase/migrations/20261013000000_shared_collections.sql` before deploying.

### Plans

`GET /api/v1/library` also returns `plan`: `"pro"` or `"free"`. A missing `plan` (an older server) means free. See
`docs/adr/0002-free-libraries-stay-on-their-platform.md` and `src/lib/plan.ts`.

A Pro-only action called by a free account does nothing and answers `200` with `{ "ok": false, "reason": "pro" }`,
never a 401, so nobody is signed out. Today that's `setCollectionShared` with `true` (turning sharing off always
works), `setAlertThreshold`, `uploadLibrary` and `enrichLink`. iOS maps it to `AppError.proRequired`.

`POST /api/crawl` and a save without content (`createLink` with no excerpt) run a free crawl for a free account or a
signed-out caller: no AI summary or tags, and no headless-browser retry. A page that refuses the plain fetch falls
back to microlink, then to its own metadata, then to the URL.

While its owner is on Free, a shared collection reads as not shared: `GET /api/v1/shared/<token>` and `/s/<token>`
answer 404, and `saveFromShare` refuses. The token is kept, so the same link works again once the owner is Pro.

Apply `supabase/migrations/20261102000000_grandfather_pro.sql` right before deploying: it makes every existing
account Pro.

### Installs without an account

A free iOS install keeps a local library and has no account (ADR 0002). The server calls it still needs take Apple's
App Attest instead of a session, and the server stores nothing for them but the key. The checks are in
`src/lib/app-attest.ts`; the iOS side is `AppAttestClient` and `LocalServices` in AnyLinkKit Networking.

| Call | What it does |
|---|---|
| `GET /api/attest/challenge` | `{ challenge }`, good for five minutes. |
| `POST /api/attest/register` | `{ keyId, attestation, challenge }`: the key id from `DCAppAttestService.generateKey()` and, in base64, `attestKey(keyId, clientDataHash: SHA-256(challenge))`. Stores the key once the attestation checks out for `376HNWM383.com.shaggspeare.anylink`, in either environment. Answers `{ "ok": true }`. |
| `POST /api/crawl` | Without a session, a call that carries an assertion runs a free crawl on its key's daily cap instead of the per-IP limit. |
| `POST /api/v1/local/check` | No session. `{ links: [{ id, url, title }] }` → the `/api/import/check` NDJSON, for up to 600 links a call. Links are checked in order, and `remaining` counts the ones at the end that the call didn't reach. |
| `POST /api/v1/local/group` | No session. `{ priorities, links: [{ id, title, domain, note? }] }` → `groupInbox`'s `GroupedResult[]`, with new collection ids for the caller to create. Leave dead links out. |

A signed call sends `X-AnyLink-Key: <key id>` and `X-AnyLink-Assertion: <base64 of generateAssertion(keyId,
clientDataHash: SHA-256(body))>`. The assertion's counter has to go up on every call.

Refusals are never a 401:
- `403 { "reason": ... }`: `attestation-required` (no assertion), `unknown-key` (register a new key), `replay` (the
  counter didn't go up, usually two calls arriving out of order: sign again and retry once), `invalid`, or, at
  registration, `challenge`.
- `429 { "reason": "daily-cap" }`: per key and UTC day, 200 crawls, 5,000 checked links and 10 groupings
  (`DAILY_CAPS`). Groupings also stop at 300 a day across all keys together (`DAILY_GROUPS_ALL_KEYS`, counted in
  `app_attest_daily`; apply `supabase/migrations/20261103010000_app_attest_daily.sql` too).
- `503`: the server has no `APP_ATTEST_SECRET`.

The simulator can't attest, so DEBUG builds there send `X-AnyLink-Dev: <APP_ATTEST_DEV_SECRET from Config.xcconfig>`
instead. A server accepts it only where its own `APP_ATTEST_DEV_SECRET` is at least 32 characters and matches, and
never on Vercel's production deployment (`VERCEL_ENV=production`), whatever the variable says. Don't set it in
production anyway.

The server reads `APP_ATTEST_SECRET` (a long random string that signs the challenges) and, in development only,
`APP_ATTEST_DEV_SECRET`. Apply `supabase/migrations/20261103000000_app_attest_keys.sql` before deploying.

### Export

`GET /api/v1/export?format=html|json|csv` answers with the library as a file (`Content-Disposition: attachment;
filename="anylink-<yyyy-mm-dd>.<format>"`). Trash isn't in it. The writers are in `src/lib/export.ts`.

- `html`: Netscape bookmark HTML. Each collection is a folder, and each link keeps `ADD_DATE` and `TAGS`. Notes have
  no URL, so they're left out.
- `json`: `{ format: "anylink", version: 1, exportedAt, collections, links }`, where `collections` and `links` are
  the `Collection` and `LinkItem` shapes from `GET /api/v1/library`.
- `csv`: `url,title,collection,tags,note,saved_at,excerpt`, quoted per RFC 4180 and starting with a UTF-8 byte-order
  mark.

Pro only. A free account gets `403` with `{ "ok": false, "reason": "pro" }`, never a 401, and iOS maps it to
`AppError.proRequired`, which opens the paywall. A missing or unknown `format` gets 400.

### Templates

`contentType` can also be `"recipe"`. Builds from before Phase 6 decode it strictly, so the server sends them
`"article"` instead: `/api/v1/library`, `/api/v1/shared/<token>`, `/api/v1/actions/*` results and the `/api/crawl`
events all name only the types listed in the request's `X-AnyLink-Types` header (comma-separated; `src/lib/ios-types.ts`).
iOS sends every case of `ContentType`, and reads a type it doesn't know as `article`.

`LinkItem.templateData` and the crawl result's `templateData` carry what the Pro templates show, read from the page
without AI (`TemplateData` in `src/lib/types.ts`). Which fields are set depends on the type:

- article: `author`, `publishedAt` (ISO 8601)
- video: `provider` (`"youtube"`, `"vimeo"` or the site's domain), `videoId`, `channel`, `durationSeconds`. Videos
  saved before Phase 6 get `provider` and `videoId` from their URL.
- recipe: `ingredients`, `steps`, `prepMinutes`, `cookMinutes`, `totalMinutes`, `yield`

Numbers are whole. Pass the crawl's `templateData` back in `createLink`. Apply
`supabase/migrations/20261105000000_templates.sql` before deploying.

### Billing

Pro is bought only in the iOS app, through StoreKit 2: `com.shaggspeare.anylink.pro.monthly` and `.yearly` (the
subscription group "AnyLink Pro") and `com.shaggspeare.anylink.pro.lifetime`. Every purchase sets `appAccountToken`
to the signed-in Supabase user id, and that's how the server ties a purchase to an account.

| Call | What it does |
|---|---|
| `POST /api/v1/billing/apple { "jws": "<Transaction.jwsRepresentation>" }` | Signed in. Verifies the transaction against Apple's root certificates and records it: `{ "ok": true }`. A refusal is a 403 (never a 401) with `{ "ok": false, "reason" }`: `signed-out`, `environment` (Production without `APPLE_APP_ID` on the server, or Xcode/LocalTesting without `APP_STORE_ALLOW_XCODE=1`), `invalid` (didn't verify), `account` (its `appAccountToken` is another user's) or `product`. A refunded or revoked transaction ends Pro. |
| `POST /api/billing/apple/notifications` | **From Apple:** App Store Server Notifications V2, for production and sandbox. Renewals, expiry, billing grace periods, refunds and revokes update the account in the transaction's `appAccountToken`. Any other verified type is logged and answered 200. |

The plan is `users.plan`, `plan_product` and `plan_expires_at`: an account is Pro while `plan` is `pro` and
`plan_expires_at` is empty (lifetime, or grandfathered) or still ahead. `GET /api/v1/library`'s `plan` already has the
expiry applied. A lifetime account that has saved 1,000 links this calendar month gets free crawls until the month
turns.

The app posts each verified transaction after a purchase, on Restore, and for every `Transaction.updates` from launch,
then finishes it and refreshes the library. A transaction the server didn't take stays unfinished, so StoreKit offers
it again at the next launch.

Apply `supabase/migrations/20261104000000_plan_expiry.sql` before deploying.

### Upgrade and lapse

Going Pro moves an iOS local library into the account's server library (the upgrade, `CONTEXT.md`). iOS uploads it
in batches; the server merges it with whatever the account already has.

| Call | What it does |
|---|---|
| `POST /api/v1/actions/uploadLibrary [{ collections, links }]` | Pro only. `collections` is every local collection (the inbox with `isInbox: true`), sent with each batch. `links` is up to 200 `LinkItem`s as the phone stores them; an image item adds its JPEG as `image` (base64), one image a call so a request stays under 4.5 MB. Answers `{ "ok": true, created, merged }`. |
| `POST /api/v1/actions/enrichLink ["<linkId>"]` | Pro only. The AI step for a link saved without it: the summary (`excerpt`), tags and type, from the text it has stored. Answers the updated `LinkItem`, or `null` when there's nothing to do: not `aiPending`, a lifetime account past its fair use this month, or a link with no text stored, which is read again in the background. |

How `uploadLibrary` matches (`src/lib/library-merge.ts`):
- A collection lands on one with the same name, ignoring case; a smart collection needs the same query too; the inbox
  lands on the inbox. Anything else is created.
- A link matches the row it was uploaded as before (the row's `clientId` is the link's id), the row it came down from in
  a lapse (the row's id is the link's id), or, for a page, a row with the same URL ignoring the scheme, `www.`,
  tracking parameters and trailing slashes. Notes and images match by id only.
- A match keeps the server's copy and adds the phone's tags, its highlights (by quote) and its note (unless one note
  already holds the other), takes the earlier save date, and keeps pinned or favourite from either side, still at
  most two pinned links.
- Anything else is inserted as the phone had it, with `clientId` set to its id and `aiPending: true`. Sending a batch
  again creates nothing.

`LinkItem` gains two fields: `aiPending` (saved without the AI step: a free crawl or an upload; iOS and web call
`enrichLink` when a Pro account opens it) and `clientId` (the id it had on the phone). When the library says
`plan: "free"` again, iOS copies it into the local library, matching by id, `clientId` and URL, and deletes nothing
(the lapse).

Apply `supabase/migrations/20261106000000_upload_library.sql` before deploying.
