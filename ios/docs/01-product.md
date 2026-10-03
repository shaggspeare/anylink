# 01 · Product

## What AnyLink is

A personal library for saved links. You paste, share or import a URL. The server crawls the page and returns:

- title, summary, hero image and reading time;
- content type (article, video or product);
- suggested tags.

You get an editable card before saving, or in version B, right after saving. Links live in **collections**. Product
pages become spec sheets with price tracking. One small **query language** powers search, filters and saved filters.

The iOS app is a native client of the existing web app. All crawling, enrichment, link-health checks and price checks
run **on the server**. The app streams results and displays them. It never crawls on device.

## Principles (keep them, test them)

| # | Principle | What it means in the app |
|---|---|---|
| 1 | **Capture never blocks.** | Saving needs only a collection, and that defaults to Unsorted. A failed or blocked crawl still produces a saveable card. In B, the share extension saves immediately and the Add sheet's *Save now* works mid-crawl. |
| 2 | **Nothing is deleted outright.** | Delete = move to Trash. Every destructive action shows a toast with **Undo** for 5 s and also registers with `UndoManager` (shake). Only *Delete forever* and *Empty Trash* are final, and both confirm. |
| 3 | **The user's edits beat the AI.** | If the user edits a field while the AI pass is still running, the AI result never overwrites that field. |
| 4 | **Honest states.** | "Excerpt only", "title guessed from the link", "still reading the page" are said out loud, never hidden. |
| 5 | **Dead means gone, not refused.** | Only HTTP 404/410, no answer (0) or a parked domain (1) count as broken. 402/403/429/503 from bot walls do not. |
| 6 | **One query language everywhere.** | Filters, search, saved filters and tag chips are all query strings (`06-query-language.md`). |

## Voice

Short, plain, second person, a little dry. Explain consequences, never blame. Examples:

- "Nothing saved yet" · "Reading the page…" · "Links stay here until you delete them."
- "The site wouldn't give up the full page — this card is built from its metadata and written up by AI. Worth a glance before you save."
- "Dissolving moves its links back to Unsorted and deletes the collection."

Avoid exclamation marks, "Oops", apologies, and system words ("payload", "sync job", "endpoint").

## Version B: what makes this app different from a port of the web app

These are the deliberate choices from the design review (`10-decisions.md` has the reasoning):

1. **Capture-first chrome.** A *Paste a link* capsule lives in `.tabViewBottomAccessory` on every tab. It shows
   *Link on your clipboard* when `UIPasteboard` detects a probable web URL, without reading the clipboard, so iOS
   shows no paste alert. Tabs: **Library · Collections · Search** (`Tab(role: .search)`).
2. **System font for system chrome.** SF Pro is used for tab labels, nav titles, menus, sheet headers, list rows and
   toggles. **Instrument Sans** is used for content and brand: large titles, card titles, the hero line.
3. **Bigger content.** Tiles with a 92 pt hero, and a type-aware meta line (reading time, video length or price).
   Reader body text is 17 pt.
4. **Designed for real data.** Imported links usually have no image or summary, so the striped identity fallback is a
   first-class design. Product pages are designed around price, stock, rating and the chart. Specs collapse when
   there are few.
5. **Triage.** The **Sort Unsorted** screen lets you swipe inbox links into their suggested collection. It reuses
   the onboarding Keep/Bin gesture.
6. **Native patterns over web ones.**
   - Long-press context menu with a preview.
   - `List` swipe actions.
   - Select mode with a bottom glass toolbar.
   - `.confirmationDialog` for destructive actions.
   - `.searchable` tokens.
   - Card size (S/M/L) is hidden on iPhone.

## v1 scope

| Area | In v1 (iPhone) | Later |
|---|---|---|
| Accounts | Sign in with Apple, email magic link, sign out, delete account | — |
| Onboarding | Import (bookmarks HTML, Telegram JSON), Clean, Keep or bin, Collections result | Live Activity for the link check |
| Library | Tiles ⇄ rows, scope chips, Unsorted banner, sort menu, context menu, select mode, bulk Move/Tag/Archive/Trash, pull to refresh | Drag to reorder (P1), iPad mosaic |
| Capture | Paste accessory, Add sheet with streamed crawl, Share Extension | Control Center control, Safari web extension |
| Collections | Grid, create, rename, dissolve, filters, custom filters, suggested filter, tags, Trash, delete empty | Drag-reorder collections |
| Search | `.searchable` with tokens, live results, snippets, Save as filter | Spotlight-only results |
| Detail | Reader (note, highlight add, favorite, move), video variant, product (chart, alert threshold) | Highlight list/delete, push price alerts (backend) |
| Triage | Sort Unsorted | — |
| Settings | Appearance, open links in, capture setup, tips reset, account | — |
| Native | Haptics, Undo, TipKit, Spotlight indexing, App Intents (save link) | Widgets, Handoff, background refresh |

## Out of scope for v1

iPad layout (planned for phase 14), widgets, Live Activities, push notifications, Unarchive (there's no web support
yet, so the Archived filter is read-only), per-view manual order, the Notion import, and showing the same product
at other retailers.
