# 09 · Testing

## Layers

| Layer | Tool | Where | Runs |
|---|---|---|---|
| Unit | Swift Testing (`@Test`, `#expect`, parameterised `arguments:`) | `Packages/AnyLinkKit/Tests/*` | `swift test` after every package change |
| Store / intents | Swift Testing + `MockAPI.failNext` | `StoreTests` | same |
| Networking | `URLProtocol` stub serving NDJSON and JSON | `NetworkingTests` | same |
| UI flows | XCUITest, launch args `-ui-testing -reset` | `AnyLinkUITests` | each phase gate |
| Accessibility | `XCUIApplication().performAccessibilityAudit()` | `AnyLinkUITests/AccessibilityTests` | phase 13 onward |
| Visual | `#Preview` light/dark/XXL + manual compare with the prototype | Xcode canvas | every UI task |

Add snapshot tests only if a reviewer asks; the previews plus the manual checklist are the visual contract.

## Must-have unit tests

- Fixture decoding (all files); `CrawlEvent` decoding for every event type, including the failure without identity fields.
- Crawl stream: ends without a terminal event → `.failed(network)`. A 400 response → invalid-url.
- The whole query table (`06`), round-trip serialisation, and a 5k-link performance test.
- `AddLinkModel`:
  - an edited title or excerpt survives `done`;
  - Cancel stops the stream;
  - Save mid-crawl produces a draft with what's known.
- `LibraryStore`:
  - each intent;
  - rollback on failure;
  - Undo for trash, move, dissolve and archive;
  - the suggested filter rule (≥ 3 live links, not already a name);
  - the triage suggestion heuristic.
- Reader rule: < 40 words of prose (paragraphs with ≥ 8 words) → excerpt fallback.
- Product: `% since saved` from history; hidden when ≤ 0 or with < 2 points.
- Parsers: Netscape bookmarks (nested folders, `ADD_DATE`), Telegram JSON (`text` as a string or an array of
  entities); merge + dedupe; the 5,000 cap.
- Broken rule: 0, 1, 404, 410 → broken; 402, 403, 429, 503 → not.

## UI test flows (MockAPI, deterministic)

1. `testPasteSaveFlow`: accessory Paste (inject the URL via launch environment `UITEST_PASTE_URL`, because UI tests
   can't tap the system PasteButton reliably) → the card develops → Save → the tile appears first → Undo removes it.
2. `testTrashAndUndoFromContextMenu`
3. `testSelectMoveTag`: select 3 → Move to Reading → Tag #later → the counts update.
4. `testSearchTokens`: type `type:video ` → a token appears → results are videos only → Save as filter.
5. `testTriage`: swipe right twice, left once → Unsorted count −3 → Trash has 1.
6. `testDissolveUndo`
7. `testOnboardingHappyPath` (fixture files injected through the launch environment instead of `fileImporter`)
8. `testShareExtension` (phase 12): launch Safari to a local page, share → AnyLink. If that's flaky in CI, keep it
   manual.

## Manual QA checklist (each phase gate, iPhone 17 Pro simulator + one device if available)

- [ ] Light and dark, plus System switching while the app is open
- [ ] Largest accessibility text size: nothing clipped, titles wrap, the tab bar still works
- [ ] Reduce Transparency: frosted → solid paper, orbs hidden
- [ ] Reduce Motion: no entrance springs, swipe cards cross-fade
- [ ] VoiceOver: every control is labelled, tiles are single elements, rotor actions work
- [ ] Offline (Network Link Conditioner, 100 % loss): optimistic changes stay, a banner shows, they sync after reconnect
- [ ] No paste alert appears anywhere except an explicit paste
- [ ] Rotation is locked to portrait on iPhone (until phase 14)
- [ ] Compare each screen with the prototype: spacing, copy, toasts
