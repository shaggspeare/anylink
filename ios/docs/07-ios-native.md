# 07 · Native iOS capabilities: implementation notes

Priority key: **P0** v1 must-have · **P1** v1 if time allows · **P2** later.
Where an API signature here and the iOS 26 SDK disagree, **the SDK wins**. Check the headers or the docs, adapt,
and note the change in `10-decisions.md`.

## Tabs, glass, accessory (P0)

```swift
TabView(selection: $router.tab) {
    Tab("Library", systemImage: "link", value: AppTab.library) { LibraryStack() }
    Tab("Collections", systemImage: "folder", value: AppTab.collections) { CollectionsStack() }
    Tab(value: AppTab.search, role: .search) { SearchStack() }
}
.tabBarMinimizeBehavior(.onScrollDown)
.tabViewBottomAccessory { PasteAccessory() }
```

- `PasteAccessory` reads `@Environment(\.tabViewBottomAccessoryPlacement)`. In the inline (minimised) placement,
  show only the icon and the Paste button.
- Pushed detail screens (`.link`, `.triage`, `.settings`) hide the tab bar with
  `.toolbarVisibility(.hidden, for: .tabBar)`. Check that the accessory hides with it. If it doesn't, make the
  accessory's content conditional on `router.showsAccessory`.
- Custom floating controls use `.glassEffect(...)` inside a `GlassEffectContainer`. Primary floating actions use
  `.buttonStyle(.glassProminent)` + `.tint(AL.signal)`.

## Clipboard without the paste alert (P0)

- **Detect, don't read.** On `scenePhase == .active` and on `UIPasteboard.changedNotification`, call
  `UIPasteboard.general.detectPatterns(for: [\.probableWebURL])`. A hit sets `store.clipboardHasURL = true`.
  Cache by `UIPasteboard.general.changeCount` so you don't re-detect.
- **Read only on user action**, using `PasteButton(payloadType: URL.self) { urls in … }`. It shows no alert.
  Style it with `.buttonBorderShape(.capsule)`, `.tint(AL.lime)` and `.labelStyle(.titleAndIcon)`.
- Never read `UIPasteboard.general.url` or `.string` on launch.
- Respect the Settings toggle "Clipboard suggestions". When it's off, skip detection.
- iPad hardware keyboard ⌘V (P1): override `paste(_:)` in a small responder host and route to the Add sheet.
  It is user-initiated, so no alert appears.

## Add sheet streaming (P0)

```swift
@Observable @MainActor final class AddLinkModel {
    var step = 0; var result: CrawlResult?; var failure: CrawlFailure?
    var title = ""; var excerpt = ""; var tags: [String] = []; var collectionID = "unsorted"; var note = ""
    private var edited: Set<Field> = []          // principle 3
    private var task: Task<Void, Never>?
    func start(_ url: URL) { task?.cancel(); task = Task { for try await e in api.crawl(url) { apply(e) } } }
    func apply(_ e: CrawlEvent)                  // never overwrite a field in `edited`
    func cancel() { task?.cancel() }
}
```

- Sheet: `.presentationDetents([.medium, .large], selection: $detent)`. Switch to `.large` when crawling starts.
  Add `.presentationDragIndicator(.visible)` and `.interactiveDismissDisabled(model.isSaving)`.
- `.sensoryFeedback(.success, trigger: model.step == 3)`.

## Share Extension (P0)

`ShareExtension/Info.plist`:

```xml
<key>NSExtension</key><dict>
  <key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string>
  <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
  <key>NSExtensionAttributes</key><dict>
    <key>NSExtensionActivationRule</key><dict>
      <key>NSExtensionActivationSupportsWebURLWithMaxCount</key><integer>1</integer>
      <key>NSExtensionActivationSupportsText</key><true/>
    </dict>
  </dict>
</dict>
```

- `ShareViewController: UIViewController` hosts `ShareView` in a `UIHostingController`. Get the URL from
  `extensionContext?.inputItems`:
  - `provider.loadTransferable(type: URL.self)`;
  - otherwise load the `String` and find the first `http(s)` URL with `NSDataDetector`.
- Save immediately with `createLink` (title from `NSExtensionItem.attributedContentText` if present). Then start
  the crawl. Stop listening when the user taps **Done**; the server or the app finishes enrichment
  (`05` § Gaps).
- Shares: App Group (SwiftData + `PendingSave`), shared keychain (auth), `AnyLinkKit`.
- **Memory:** no image decoding beyond a 52 pt thumbnail. No `LibraryStore`: use `AnyLinkAPI` directly plus a tiny
  `RecentCollections` read from the App Group.
- Close with `extensionContext?.completeRequest(returningItems: nil)`.

## Open original (P0)

- `SafariView: UIViewControllerRepresentable` wraps `SFSafariViewController`, with
  `configuration.entersReaderIfAvailable = false` and `preferredControlTintColor = UIColor(AL.signal)`. Present it
  with `.fullScreenCover`.
- When the setting is "Safari": `openURL(url)`.

## Context menus, swipes, selection, confirmations (P0)

- `.contextMenu { … } preview: { LinkPreviewCard(link) }` on tiles and rows.
- `List` rows: `.swipeActions(edge: .leading)` for Favorite; `.swipeActions(edge: .trailing, allowsFullSwipe: true)`
  for Trash and Move.
- Selection:
  - rows use `List(selection: $selection)` with `.environment(\.editMode, .constant(router.isSelecting ? .active : .inactive))`;
  - tiles use a custom tap-to-toggle;
  - the bottom toolbar uses `.toolbar { ToolbarItemGroup(placement: .bottomBar) { … } }`.
- Destructive actions: `.confirmationDialog(title, isPresented:, titleVisibility: .visible) { Button(role: .destructive) … }`.

## Undo (P0)

`UndoCenter` (`@MainActor`) holds the last undoable action for the toast and also registers it with the window's
`UndoManager` (`@Environment(\.undoManager)`), so shake to undo works. The toast shows for 5 s; Undo calls the
inverse intent.

## Search (P0)

```swift
.searchable(text: $model.text, tokens: $model.tokens, placement: .automatic, prompt: "Search links, #tags…") { token in
    Label(token.label, systemImage: token.systemImage)
}
.searchSuggestions { ForEach(model.suggestedTokens) { t in Text(t.label).searchCompletion(t) } }
```

Highlighting: build an `AttributedString` and set `backgroundColor = AL.lime` and `foregroundColor = AL.onAccent`
on the matched ranges.

## Reader highlights (P1)

`HighlightableText: UIViewRepresentable` wraps a non-editable, selectable `UITextView`:

- Build `NSAttributedString` from the `articleText` blocks: 17 pt Instrument Sans, line height 1.65,
  paragraph spacing 22. Existing highlights get a lime .60 background.
- Delegate `textView(_:editMenuForTextIn:suggestedActions:)` returns
  `UIMenu(children: [UIAction(title: "Highlight", image: UIImage(systemName: "highlighter")) { … }] + suggestedActions)`.
- On Highlight: `store.addHighlight(id, quote: selectedText)`, re-render, then the toast "Highlighted".
- Size it with `sizeThatFits` in `ScrollView` (`isScrollEnabled = false`).

## Charts (P1)

```swift
Chart {
    ForEach(points) { p in
        LineMark(x: .value("Day", p.day), y: .value("Price", p.price)).foregroundStyle(AL.periwinkle).lineStyle(.init(lineWidth: 3))
        PointMark(x: .value("Day", p.day), y: .value("Price", p.price)).symbolSize(p.isLast ? 80 : 20)
    }
    if let t = threshold { RuleMark(y: .value("Alert", t)).foregroundStyle(AL.signal).lineStyle(.init(lineWidth: 1.5, dash: [5, 5]))
        .annotation(position: .top, alignment: .trailing) { Text("Alert \(t.formatted(.currency(code: code)))") } }
}
.chartYScale(domain: lower...upper).chartXAxis { AxisMarks(values: [first, last]) }
```

## Onboarding import (P1)

- `.fileImporter(isPresented:, allowedContentTypes: [.html, .json], allowsMultipleSelection: true)`. Wrap each
  file read in `url.startAccessingSecurityScopedResource()` and the matching stop call.
- The parsers are pure functions in `AnyLinkKit` (`BookmarksParser`, `TelegramParser`), with tests on samples.
- Link check (`/api/import/check`): show progress in the Clean step. A Live Activity is **P2**.

## TipKit (P1)

`try? Tips.configure([.displayFrequency(.daily)])` at launch. Tips, each shown once and in context with `.popoverTip`:

| Tip | Anchor | Text |
|---|---|---|
| `PasteTip` | Paste accessory | "Copy a link anywhere, then Paste — AnyLink reads it for you." |
| `LongPressTip` | First tile | "Long-press a card for Move, Favorite and Trash." |
| `SearchTip` | Search field | "Search takes filters like type:video or #design." |
| `SortTip` | Unsorted banner | "Swipe through Unsorted to file links in seconds." |
| `ShareSheetTip` | Settings → Share sheet, Empty state | "In Safari, tap Share, scroll the app row, tap More and pin AnyLink." |

## Spotlight (P1)

`SpotlightIndexer` (actor): for each live link, create a `CSSearchableItem(uniqueIdentifier: link.id, domainIdentifier: "links", attributeSet:)`.
The attribute set (`contentType: .url`) carries the title, `contentDescription` = excerpt and the domain, plus
`thumbnailData` from the image cache when available.

- Delete items on trash or purge.
- Handle `.onContinueUserActivity(CSSearchableItemActionType)` → `Router.open(.link(id))`.

## App Intents (P1)

```swift
struct SaveLinkIntent: AppIntent {
    static let title: LocalizedStringResource = "Save Link"
    @Parameter(title: "Link") var url: URL
    @Parameter(title: "Collection") var collection: CollectionEntity?
    func perform() async throws -> some IntentResult & ProvidesDialog {   // inbox by default, no UI
        _ = try await api.createLink(LinkDraft(url: url, collectionId: collection?.id ?? "unsorted"))
        return .result(dialog: "Saved to \(collection?.name ?? "Unsorted").")
    }
}
struct AnyLinkShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(intent: SaveLinkIntent(), phrases: ["Save to \(.applicationName)", "Save link in \(.applicationName)"],
                    shortTitle: "Save Link", systemImageName: "link")
    }
}
```

Later: `OpenCollectionIntent`, `SearchLinksIntent`, and `IndexedEntity` for links (P2).

## Deep and universal links (P1)

- `onOpenURL`: `anylink://add?url=…` opens the Add sheet prefilled; `anylink://link/{id}` opens the link.
- Associated Domains: `https://<web>/links/{id}` → `.link(id)`.

## Later (P2)

- Widgets: Recently saved (S/M), Price watch (M).
- `ControlWidget` "Save clipboard link".
- Live Activity for the link check.
- APNs for price alerts.
- Handoff (`NSUserActivity` with the web URL).
- `BGAppRefreshTask`.
- iPad `NavigationSplitView` with the S/M/L mosaic custom `Layout`.

## App icon (P1)

Build the chain mark (periwinkle, ink, signal links) as layers in **Icon Composer**, with Default, Dark, Clear and
Tinted appearances. Until then, use a flat 1024 png placeholder.
