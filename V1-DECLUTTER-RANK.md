# AnyLink v1 — Declutter & Rank: status + plan

Two parts: **A** is what exists today vs. what the brief asks for, **B** is the phased build.
One file so the two can't drift apart.

Legend: ✅ done · 🟡 partial · ❌ missing

**P0 is built and verified end to end** (2026-09-18). Part A is updated to match; Part B keeps
the phases as a record of what was done and what was deliberately left.

---

# Part A — Checklist

## A1. Import (P0 #1)

| # | Requirement | State | Where |
|---|---|---|---|
| 1.1 | Chrome/browser bookmarks HTML import | ✅ | `parseBookmarks` in [parse.ts](src/lib/import/parse.ts) — a token scan, not a DOM parse, so it runs in the browser, on the server and under `node --test` |
| 1.2 | Folder path from the bookmarks file | ✅ | `<H3>`/`</DL>` stack → `import_meta.folder` ("Bookmarks bar / Reading / Rust") |
| 1.3 | Telegram Saved Messages export | ✅ | `parseTelegram` — `result.json`, both the Saved-Messages-only and full-export shapes; message text kept as `import_meta.context` |
| 1.4 | Both sources merged in one pass | ✅ | Multi-file input on [/start](src/app/start/page.tsx) → `mergeImports`, first occurrence of a URL wins |
| 1.5 | `source` recorded per link | ✅ | `links.source` (`manual`/`chrome`/`telegram`) |
| 1.6 | Import completes in human time | ✅ | `importLinks` is one chunked multi-row insert, no crawl. 15 links in ~0.5s; the old per-link crawl path is deleted |

## A2. Dead-link detection (P0 #2)

| # | Requirement | State | Where |
|---|---|---|---|
| 2.1 | Reachability check | ✅ | [check-link.ts](src/lib/crawler/check-link.ts) — one ranged GET, 8s timeout |
| 2.2 | Status persisted | ✅ | `links.http_status` + `checked_at` |
| 2.3 | Scheduled re-check | ✅ | [cron/link-check](src/app/api/cron/link-check/route.ts), now parallel, 200/night |
| 2.4 | Surfaced to the user | ✅ | `is:broken` + sidebar "Broken links" |
| 2.5 | Runs at import, with progress | ✅ | [POST /api/import/check](src/app/api/import/check/route.ts) streams NDJSON per link; resumable, so a big library can't hit a function timeout |
| 2.6 | Parked-domain detection | ✅ | `isParked` sniffs the first 16KB for parking-service markers; reported as sentinel status `1` |
| 2.7 | Checks run in parallel | ✅ | 24 in flight, one UPDATE per wave |
| 2.8 | Flag **or** remove | ✅ | Dead links are listed, then "Remove N dead links" trashes them (recoverable), or "Keep them for now" |

**Dead means gone, not refused** — [link-health.ts](src/lib/link-health.ts) counts only 404, 410,
no-answer and parked. Verified against real sites: seriouseats.com answers a crawler with `402`
and Cloudflare sites with `403`; flagging those would have trashed live links.

## A3. Onboarding / calibration (P0 #3)

| # | Requirement | State | Where |
|---|---|---|---|
| 3.1 | Onboarding route | ✅ | [/start](src/app/start/page.tsx) — import → check → questions → collections, with a step rail |
| 3.2 | 3–5 calibration questions | ✅ | Four: current focus, topics, keep/kill, avoid |
| 3.3 | Keep-vs-kill on a sample | ✅ | 8 links sampled across domains; "Bin" trashes them immediately |
| 3.4 | Stated priorities persisted | ✅ | One `user_signals` row, `action: 'calibrate'` |
| 3.5 | Feature tour | ✅ | Pre-existing driver.js tour, untouched — a product walkthrough, not calibration |

Q2's options are derived from the user's own import (their folder names and most-saved
domains), so there is no hardcoded topic list to go stale.

## A4. Ranking & grouping (P0 #4)

| # | Requirement | State | Where |
|---|---|---|---|
| 4.1 | Auto-grouping | ✅ | [group-links.ts](src/lib/rank/group-links.ts) — batches of 75; batch 1 sets the vocabulary, the rest run in parallel against it |
| 4.2 | Scored against stated priorities | ✅ | Priorities go into the prompt; every collection carries a `rank` |
| 4.3 | Auto-named collections | ✅ | 2–4 word names, hallucinated/duplicate indices dropped before anything is written |
| 4.4 | `reasoning` shown to user | ✅ | `collections.reasoning`, rendered on each result card |
| 4.5 | `created_by` system/user | ✅ | `collections.created_by` |
| 4.6 | LLM call | ✅ | Shared [llm.ts](src/lib/llm.ts) `chatJson`, extracted from the crawler's enrichment call |
| 4.7 | Result screen | ✅ | Step 4 of /start |
| 4.8 | Works without the LLM | ✅ | `groupByMetadata` falls back to folder-then-domain grouping |

## A5. Signals (P0 #5)

| # | Requirement | State | Where |
|---|---|---|---|
| 5.1 | `user_signals` table | ✅ | `link_id`/`collection_id` are `set null` on delete — a signal outlives what it was about |
| 5.2 | Accept/reject a collection | ✅ | ✓/✕ per result card. Reject actually undoes the grouping (links back to Unsorted, collection deleted) as well as logging |
| 5.3 | Move a link between collections | ✅ | Logged inside `store.moveLinks`, so every move in the app is captured, not just onboarding's |
| 5.4 | Keep/kill + calibration answers | ✅ | Logged per link and as one calibration row |

Nothing reads this table, per the brief.

## A6. Data model

| Brief field | Now |
|---|---|
| `Link.url`, `.title`, `.imported_at` | ✅ — `created_at` is the date the *user saved it* (from the export) when the file says, so a fresh import reads newest-first meaningfully |
| `Link.source` | ✅ |
| `Link.status` alive/dead/unchecked | ✅ `http_status` + `checked_at` (null = unchecked). `links.status` remains the crawl lifecycle — deliberately not overloaded |
| `Link.raw_metadata` | ✅ `import_meta` (folder, saved date, Telegram message) |
| `Collection.reasoning`, `.created_by` | ✅ |
| `UserSignal` | ✅ |

## A7. Acceptance criteria — verified

Run against a real Chrome-format export (11 links, nested folders, a bookmarklet, a duplicate)
and a real-shaped Telegram `result.json` (6 messages, one with no link, a `text_link`, a
duplicate), driven through the actual UI in a browser:

| Criterion | Result |
|---|---|
| Both exports merged | ✅ 11 + 5 parsed → 15 after cross-source dedupe |
| Dead links flagged on a known-dead set | ✅ 4 of 22 — a 404 repo, a 404 path, a dead domain, an expired domain. Live-but-hostile sites (402/403) correctly left alone |
| ≥2 collections across 2+ topics | ✅ 6, e.g. "Async Rust" (3) and "Cooking References" (2), each with reasoning that cites the user's stated focus and their keep/kill picks |
| Full flow under 3 minutes | ✅ **22 seconds** wall clock end to end, ~16s of it the grouping call |

`npm test` — 25 assertions across parsing, link health, grouping and search. `npm run build` clean.

## A8. Untouched

Reader view, price tracking, highlights, card resize/mosaic, trash, favorites, notes,
command palette, product panel. `bookmarks-import.tsx` and the per-link `importBookmark`
action were **deleted** — /start replaces them.

---

# Part B — Implementation plan

## B0. Decisions this build locked in

1. **Import does not crawl.** Rows are written straight from the export file. This is the only
   change that gets the flow under three minutes; the file already carries a title, a folder
   and a date, which is enough to check, rank and group on.
2. **Dead = `http_status`**, and only 404/410/no-answer/parked count. One shared predicate in
   [link-health.ts](src/lib/link-health.ts), imported by both the server checker and the
   browser-side search filter.
3. **One LLM call per 75 links**, returning collections *with* reasoning and a rank — not a
   call per link. Indices, not uuids, so there's nothing to hallucinate; anything invalid or
   double-claimed is dropped before it reaches the database.
4. **Collections stay `collections`** — two new columns, not a new concept.
5. **Signals are write-only.**

## Phases, as shipped

| # | Phase | State |
|---|---|---|
| 0 | Schema (`source`, `import_meta`, `reasoning`, `created_by`, `user_signals`) + both parsers + tests | ✅ |
| 1 | Bulk import: one chunked insert, cross-source dedupe, dedupe against the existing library | ✅ |
| 2 | Dead-link pass: shared checker, parked sniff, parallel waves, streamed resumable route | ✅ |
| 3 | `/start` — four-step flow, questions derived from the user's own import | ✅ |
| 4 | Grouping + result screen with reasoning, with a no-LLM fallback | ✅ |
| 5 | Signals on calibrate / keep / kill / accept / reject / move | ✅ |
| 6 | Lazy enrichment backfill (excerpts, hero images, tags for imported links) | ⏭️ not built |

## What's left, in the order I'd do it

1. **Phase 6 — enrichment backfill.** Imported links have a title, a URL and nothing else: no
   excerpt, hero image or tags, so the mosaic reads plainer than it does for hand-added links.
   A cron route reusing the existing `crawlUrl` over the top-ranked N per run covers it. Ranking
   already happened without it, which is why it wasn't on the critical path.
2. **Library read cost.** [layout.tsx](src/app/layout.tsx) still loads every link — including
   `article_text` — into the client store on every route. Fine at 50 links; a 2000-link import
   will feel it. Trim the layout query to card fields and load `article_text` in the link route.
   Measure before changing: it was fine at the scale tested.
3. **Singleton collections.** With a small import the grouper sometimes returns 1-link
   collections despite being told to prefer fuller ones. Harmless at 15 links, unlikely at 400
   (batches are 75). Only worth prompt work if it shows up on a real import.
4. **Re-run grouping.** `/start` groups whatever is in the inbox, so running it again after a
   later import works — but there's no "regroup my whole library" button. Deliberate.

## Deliberately not built

- Notion import (P1 per the brief).
- Per-link LLM scoring — batch grouping returns a rank order already.
- Many-to-many link↔collection. One collection per link, as today.
- Anything that consumes `UserSignal` — explicitly deferred by the brief.
- A unique index on `(user_id, url)`. The app surfaces duplicates as a feature (`is:duplicate`),
  so the import filters instead.

