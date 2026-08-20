# Handoff: AnyLink — link storage web app

## Overview
AnyLink is a personal link library: paste a URL, it is crawled and enriched, then filed into a collection and shown as a resizable card in a mosaic. Includes a reader view, a product/PDP variant with price tracking, ⌘K search, multi-select collections, and mobile web screens.

## About the design files
The files in `design/` are **design references created in HTML** — prototypes of look and behaviour, not production code. Recreate them in the target codebase's existing environment (React/Vue/etc.) with its established patterns and libraries. If no codebase exists yet, choose the stack in the plan.

## Fidelity
**High-fidelity.** Colours, typography, spacing, radii and interaction states are final.

## Screens (ids match the design canvas)
- **2a — Library.** 250px glass sidebar (wordmark, collections with colour markers + counts, ⌘V hint pinned bottom) · header (title, count, add button) · card mosaic, 3 columns at 1280, gap 14px. Every card carries an S/M/L switch and a live corner resize handle; dragging past ~1.5 columns snaps to the next size. Live add-link crawl runs from this screen's Add button.
- **3a — Add a link (empty).** Hero "Paste anything. We read the rest." (52px/600/-.055em), URL field (58px pill) + Fetch, clipboard suggestion card, drop zone and extension cards.
- **3b — Crawling.** Left: crawl progress steps and found hero thumbnails. Right: editable form (title, excerpt, collection, size — collection and size required, inline errors on blur) with a fixed live card preview that updates as you type.
- **3c — Landing page.** Marketing page reusing the library mosaic as hero art.
- **4a — Link detail / reader.** Header breadcrumb + Open original / Add to collection / more. Reader panel (hero 250px with gradient + title overlay, article body max-width 600px, inline highlight, pull quote) beside a 320px rail: Saved metadata, Tags, Also in your library.
- **4b — ⌘K search.** Dimmed, blurred library behind a 720px palette: query line with caret, grouped results (Links with `<mark>` highlighting, Tags & collections), "save as smart collection" action, keyboard-hint footer.
- **4c — Collection + multi-select.** Collection header (name, marker, counts, filter/sort chips), card grid with selected cards showing a 2px ink ring and a lime check, dark floating bulk bar (count, Move to…, Tag, Archive, Delete).
- **4d — Mobile.** iPhone frames: library (sticky glass header with search pill and collection chips, one lead card + compact rows, glass bottom tab bar) and add-a-link (paste field, clipboard card, share-sheet hint) with the keyboard up.
- **4e — Product detail.** Same chrome as 4a with a "Product detected" chip: product image, price with change-since-saved, stock/delivery/rating chips, variant swatches, 26-row spec table ("26 of 38 shown"); rail carries a price-history chart with alert threshold and the same product saved at other retailers.

## Interactions & behaviour
- Card resize: S/M/L switch and drag handle; size persists per link.
- Add flow: paste → crawl progress → editable form → save; collection + size required; inline errors on blur; live preview.
- Multi-select: click to toggle, shift-click for a range, bulk bar appears with count.
- Palette: ⌘K opens, ↑↓ navigate, ↵ opens in reader, ⌘↵ opens the original, esc closes, ⌘S saves the query as a smart collection.
- ⌘V anywhere captures the clipboard URL.
- Price watch: threshold alert, checked twice daily.

## Design tokens
Canvas #eceef0 · Ink #17181b · Paper #ffffff · Doc shell #0d0e10 (design canvas only) · Signal orange #ff5a1f · Lime #d6f24b · Periwinkle #7c8cff · Slate #9aa3ad.
Ink alphas: 1, .6, .5, .45, .2, .06.
Type: Instrument Sans 400/500/600/700 — Display 56/600/-.055em, Hero 52/600/-.055em, Title 22/600/-.03em, Wordmark 17/600/-.035em, Lead 14.5/400/1.55, Body 13.5/500, Meta 11.5/400, Eyebrow 10.5/600/.14em uppercase.
Radii: 7 (kbd), 9 (logo/badge), 14 (nav row), 20–24 (cards), 26–28 (panels), 999 (controls).
Spacing: 8, 14, 18, 26, 48, 70.
Glass: fill rgba(255,255,255,.42/.55/.70), border 1px rgba(255,255,255,.8), backdrop-filter blur(16–28px) saturate(1.4); never stack two glass layers.
Ambient: blurred colour orbs, opacity .24–.34, blur 120–150px.
Elevation: card 0 2px 8px -2px /.14 · popover 0 14px 34px -12px /.28 · window 0 30px 70px -20px /.45.

## Assets
All imagery in the prototypes is picsum.photos placeholder photography — replace with real crawled hero images. Icons are inline SVG (2.4–2.8 stroke, round caps); swap for the codebase's icon set.

## Files
- `PROMPT.md` — the planning prompt to give Claude Code first.
- `design/AnyLink.dc.html` — all screens.
- `design/AnyLink Design Tokens.dc.html` — token sheet.
- `design/ios-frame.jsx`, `design/support.js` — prototype scaffolding (not production).
