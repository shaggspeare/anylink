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
