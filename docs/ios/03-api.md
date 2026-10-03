# Backend API for the iOS app

The Next.js app is the only backend. The web UI calls it through server actions, and the iOS app calls the same functions over HTTP, so the two can't drift apart.

Every `/api/v1` request needs `Authorization: Bearer $API_TOKEN`. Set `API_TOKEN` in the Vercel env. If it's unset, the API returns 401 for every request.

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
POST /api/v1/actions/createCollection  ["Reading", "#7c8cff"]
POST /api/v1/actions/createLink        [{ ...LinkItem fields minus id/createdAt/status/archived/highlights }]
```

Errors come back as `{ "error": "..." }` with status 400, 401, or 404.
