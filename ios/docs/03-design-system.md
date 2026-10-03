# 03 · Design system

All values come from `spec/01-design-tokens-and-visual-spec.md`, which uses **1 web px = 1 pt**. This file turns them
into Swift and adds the **version B** component specs. Build these in `AnyLinkKit/Sources/DesignSystem`, and render
each one on a DEBUG-only **Gallery** screen (phase 2) before using it in features.

## 1. Tokens (`Tokens.swift`)

Start from spec §15 verbatim (`AL` enum: theme colours, accents, radius, space, control, identity). Then add:

```swift
extension AL {
    // B additions
    static let inStockFill = Color(hex: 0x00A046).opacity(0.14)
    static let noticeFill  = Color(hex: 0xFF5A1F).opacity(0.14)
    static let periwinkleFill = Color(hex: 0x7C8CFF).opacity(0.18)

    enum Ink {                       // always applied as opacity over what's beneath; never pre-mixed greys
        static let a85 = 0.85, a80 = 0.80, a75 = 0.75, a65 = 0.65, a60 = 0.60, a55 = 0.55
        static let a50 = 0.50, a45 = 0.45, a40 = 0.40, a30 = 0.30, a20 = 0.20, a16 = 0.16
        static let a12 = 0.12, a08 = 0.08, a06 = 0.06, a05 = 0.05
    }
    enum Motion {
        static let entrance = Animation.timingCurve(0.22, 1.35, 0.36, 1, duration: 0.7)
        static let reorder  = Animation.timingCurve(0.2, 0.9, 0.3, 1.15, duration: 0.26)
        static let settle   = Animation.timingCurve(0.2, 0.9, 0.3, 1.15, duration: 0.22)
        static let sheet    = Animation.timingCurve(0.2, 0.9, 0.3, 1, duration: 0.28)
        static let progress = Animation.easeInOut(duration: 0.5)
        static let entranceScales: [CGFloat] = [0.72, 1.14, 0.86, 1.22, 0.64, 1.06]
        static func stagger(_ i: Int) -> Double { min(Double(i) * 0.035, 0.6) }
    }
    enum Shadow {   // light: ink at alpha; dark: black at the dark alpha (spec §7)
        static let card    = (y: 2.0,  radius: 4.0,  light: 0.14, dark: 0.50)
        static let popover = (y: 14.0, radius: 17.0, light: 0.28, dark: 0.60)
        static let window  = (y: 30.0, radius: 35.0, light: 0.45, dark: 0.75)
    }
}
```

Provide `View.alShadow(_:)`, which reads `colorScheme` and picks the ink or black variant.

## 2. Typography

Two families:

| Role | Family | Use |
|---|---|---|
| **Brand / content** | Instrument Sans 400/500/600/700 (bundled, OFL) | Large titles, card titles, hero lines, reader title, prices, chips, buttons with brand copy |
| **System chrome** | SF Pro (`.system`) | Tab labels, nav bar titles, menus, list rows in Settings, sheet headers (Cancel / New link / Save), toggles, section headers, toasts |

**Bundling the font.** Download Instrument Sans from Google Fonts and add the static TTFs (Regular, Medium,
SemiBold, Bold) to `DesignSystem/Resources/Fonts`. If only the variable TTF is available, bundle that instead.
Register the fonts at launch with `CTFontManagerRegisterFontsForURL`, because package resources aren't covered by
`UIAppFonts`. Log `UIFont.fontNames(forFamilyName: "Instrument Sans")` once in DEBUG and use those exact PostScript
names.

```swift
extension AL.Font {
    /// Instrument Sans scaled with Dynamic Type. `tracking` is applied by the caller with .tracking().
    static func brand(_ size: CGFloat, _ weight: Font.Weight, relativeTo style: Font.TextStyle) -> Font
}
```

Type scale used by B (size / weight / tracking pt / Dynamic Type anchor):

| Token | Value | Used for |
|---|---|---|
| `largeTitle` | 30 / 600 / −1.65 / `.largeTitle` | Library, Collections, Search, collection name, Trash |
| `hero` | 36 / 600 / −1.6 / `.largeTitle` | Welcome "Paste anything. We read the rest." |
| `sheetHero` | 30 / 600 / −1.4 / `.title` | Add sheet idle hero |
| `readerTitle` | 30 / 600 / −1.2 / `.title` | White title on the reader hero |
| `title` | 22 / 600 / −0.66 / `.title2` | Section titles, "Saved to Unsorted", empty states |
| `cardTitleL` | 19 / 600 / −0.72 / `.title3` | Swipe cards, Add-sheet card title |
| `productTitle` | 24 / 600 / −0.9 / `.title2` | Product page |
| `price` | 34 / 600 / −1.4 / `.largeTitle` · `monospacedDigit` | Product price |
| `tileTitle` | 13.5 / 600 / −0.27 / `.subheadline` | Tiles (2 lines) |
| `rowTitle` | 14 / 600 / −0.28 / `.subheadline` | Rows (1 line) |
| `readerBody` | 17 / 400 / 0, line spacing ≈ 11 (1.65) / `.body` | Article text (**B: 17, not 15**) |
| `lead` | 14.5 / 400, line height 1.5 / `.callout` | Descriptions under titles |
| `body` | 13.5 / 500 / `.subheadline` | Default UI text |
| `chip` | 12.5 / 500 / `.footnote` | Chips |
| `meta` | 11.5 / 400 / `.caption` | Domain, counts, dates |
| `eyebrow` | 10.5 / 600 / +1.47, uppercase / `.caption2` | "WHY THIS EXISTS", "NEW LINK" |
| System | `.body` 17, `.subheadline` 15, `.footnote` 13 | Chrome, as listed above |

Monospaced (`.monospaced()`) only for query strings, crawl %, status codes.

## 3. Surfaces

```swift
struct Frosted: ViewModifier { /* spec §6.3 code */ }      // fill .62 cards/rows · .55 rails · .72 article · .86 swipe cards
extension View { func frosted(_ fill: Double = 0.62, radius: CGFloat = 22, rim: Double = 0.75) -> some View }
```

- **Glass (system):**
  - `TabView`, toolbars and `.tabViewBottomAccessory` get Liquid Glass automatically.
  - Custom floating buttons use `.glassEffect(.regular, in: .circle)` or `.capsule`.
  - Primary floating actions use `.glassEffect(.regular.tint(AL.signal).interactive())` or `.buttonStyle(.glassProminent)` with `.tint(AL.signal)`.
  - Group neighbours in a `GlassEffectContainer`.
- **Sheets:** system `.sheet` + `.presentationDetents`. Leave the background as the iOS 26 default glass for
  medium-detent sheets. Large-detent Add and ready sheets use `AL.canvas` plus the sheet orbs (spec §8.1 "Sheet").
- **Reduce Transparency:** `Frosted` becomes solid `AL.paper`; orbs are hidden.

## 4. Ambient orbs (`Orbs.swift`)

```swift
enum OrbVariant { case library, addLink, reader, product, sheet, inbox, collection(Color) }
struct Orbs: View { let variant: OrbVariant }   // RadialGradient circles, .allowsHitTesting(false), .accessibilityHidden(true)
```

| Variant | Orbs (offset · size · colour · opacity · blur) |
|---|---|
| `library` (all tab roots) | L −90, T −60 · 300 · signal · .30 · 90 ／ R −80, T 340 · 280 · periwinkle · .26 · 100 |
| `addLink` (Welcome, Add idle) | L −80, T −70 · 300 · signal · .32 · 90 ／ R −90, T 200 · 300 · lime · .34 · 110 |
| `reader` | R −150, B −180 · 520 · periwinkle · .24 · 140 (the hero covers the top) |
| `product` | L −150, T −150 · 520 · periwinkle · .26 · 130 ／ R −140, B −170 · 520 · lime · .30 · 140 |
| `sheet` | L −60, T −80 · 380 · signal · .35 · 110 ／ R −80, B 40 · 340 · periwinkle · .28 · 120 |
| `inbox` (Triage, Trash, Unsorted) | slate .40 top-left, signal .24 right |
| `collection(c)` | the collection colour at .32 top-left, periwinkle .26 right |

Frame each orb at `size + 2·blur`; the gradient's `endRadius` is `size/2 + blur`. In dark mode, multiply the
opacity by 0.45. Orbs never animate.

## 5. Identity and hero fallback (`HeroFallback.swift`)

Use the server's `tint`, `stripe` and `initial`. Use `AL.identity(for:)` (spec §15) only for offline drafts, for
example a typed URL in the Add sheet before the crawl answers.

```swift
struct HeroFallback: View {      // background = tint; horizontal bands in stripe (6 on / 13 off, period 19, from top);
    let tint: Color, stripe: Color   // centred circle Ø170 in stripe @ .28; draw with Canvas
    var band: CGFloat = 6, gap: CGFloat = 13
}
struct HeroImage: View { let url: URL?; let identity: Identity }  // AsyncImage → heroPlaceholder while loading → HeroFallback on nil/failure
```

Add a card scrim over images: black .28 at the bottom, fading to clear at 55 %. The reader hero scrim is black .80 →
.35 → clear, bottom to top. **Use black, not ink**, so white text keeps its contrast in dark mode.

## 6. Components (B)

All sizes in pt. `r` = continuous corner radius.

| Component | Spec |
|---|---|
| **InitialBadge** | Sizes 14 (r4, 8/700), 18 (r6, 9/700), 22/24 (r7, 10/700), 32 (r8). `initial` in `stripe` on `tint`. |
| **LinkTile** | 2-column `LazyVGrid`, outer padding 10 + 4 inset (14 visible edge), gap 8. Tile height **184**, r18, `frosted(.62)`, card shadow. Hero inset 6/6/0, **h92**, r13, with scrim; a video gets a 34 pt play disc (black .45). Body padding 10/8, gap 4: badge 14 + domain (11, ink .50) + ★ 12 signal when favourite; title `tileTitle`, 2 lines, fixed height 31; meta line 11/600 ink .50: `"6 min read"`, `"▶ Video"` (or `"▶ 48:12"` once the API returns a duration, see `05` § Gaps), or a price in `AL.inStock`. Pressed state: scale .97. Selected (select mode): 2 pt ink outline plus a 24 pt lime check disc at 12/12 (unselected: white 2 pt ring over black .18). |
| **LinkRow** | Inside `List` (`.listStyle(.insetGrouped)`, frosted section background) or a frosted card. Height **64**: thumb 44 r10 (HeroFallback, band 4 / gap 8, or the image), title `rowTitle` 1 line, meta `"domain · meta"` 11.5 ink .50, ★ 12 on the right. Select mode adds a leading 24 pt check circle. Swipe actions: leading **Favorite** (signal), trailing **Move** (periwinkle) and **Trash** (destructive). |
| **ScopeChip** | h34, padding 0 14, capsule, ink .06 fill, text 12.5/500 ink .72, count at .55. Selected: ink fill, onInk text. Horizontal `ScrollView`, 16 side inset, gap 8. |
| **UnsortedBanner** | Frosted r18, padding 8/8/8/14: slate dot 10, "{n} links in Unsorted" 14/600 + "Sort them in about a minute" (meta), ink button h40 "Sort". |
| **PasteAccessory** | Content of `.tabViewBottomAccessory`. Leading link icon (signal when a URL is detected, ink .45 otherwise). Title 14/600 "Link on your clipboard" with subtitle "Paste to save it", or "Paste a link". Trailing: a `PasteButton(payloadType: URL.self)` styled as a lime capsule (h38) when a URL is detected; otherwise a "New" capsule (ink .08) that opens the Add sheet. Inside a collection: title "Paste into {name}", subtitle "Saves straight to this collection". |
| **Toast** | Ink capsule, onInk text 14 (SF), padding 8/8/8/20, min-height 52, popover shadow. Optional **Undo** text button (h36, signal, 600). Bottom offset: 158 pt above the bottom edge when the tab bar + accessory are visible, 100 otherwise. Auto-hides after 5 s; a new toast replaces the old one. Move + opacity transition. |
| **CollectionCard** | Grid cell h150, r20, frosted. Mosaic h80 inset 6 r14: left half = first link's HeroFallback, right half = two stacked tints. Below: dot 8 + name 14/600 + "{n} links" meta. "New collection" cell: dashed 1.5 ink .20, r20, plus icon + label. |
| **WhyCard** | Frosted r20 padding 14. Sparkle icon (periwinkle), eyebrow "WHY THIS EXISTS", reasoning 13.5. Buttons (h34 capsules): "✓ Keep" (lime), "Rename" (ink .06), "Dissolve" (ink .06, text ink .60). |
| **SwipeCard / SwipeCardStack** | Card w = screen − 60 (342 on 402), r26, frosted .86, window shadow. Hero h170–180 inset 8 r19. A stamp appears with drag: "KEEP" (lime) or a collection name (signal) on the right swipe, "BIN" / "TRASH" (ink) on the left, rotated ±8°, opacity = abs(dx)/100. The back card is rotated −3…−5° and scaled .95. Commit at abs(dx) > 100 pt or when the velocity is high, fly-out 0.32 s. Buttons duplicate the gestures for accessibility (`.accessibilityAction(named:)`). |
| **KeepBinSegment** | Capsule track ink .06, padding 3, two halves h34: Keep selected = lime, Bin selected = ink. |
| **Buttons** | `.alPrimary` ink capsule h52 15/600 · `.alSignal` signal capsule h52 (text `onAccent`) with shadow `0 10 30 signal .7` · `.alGlass` glass capsule h52 · `.alSmall(lime/ink/soft)` h36 13/600 · text button h44 (SF, ink .60). |
| **Field** | h44, r14, ink .06 fill, no border, SF 16. URL field: capsule. |
| **Notice** | r14, `noticeFill`, padding 10/14, 12.5–13 text ink .60. |
| **Switch** | System `Toggle` with `.tint(AL.inStock)`. |

## 7. Haptics (`.sensoryFeedback`)

| Event | Feedback |
|---|---|
| Long-press lift, drag pickup | `.impact(weight: .light)` |
| Card ready in Add sheet, link saved, swipe commit | `.success` |
| Scope/sort/segment change, select toggle | `.selection` |
| Destructive confirm | `.warning` |

## 8. Motion

| Interaction | Animation |
|---|---|
| Library first load | Tiles spring in from `AL.Motion.entranceScales[i % 6]`, opacity 0→1, `AL.Motion.entrance`, delay `stagger(i)`. Skip under Reduce Motion. |
| Add card developing | The skeleton cross-fades into content per step. The hero height animates 170 → 150 when ready. |
| Crawl progress | `AL.Motion.progress` |
| Toast | `.move(edge: .bottom).combined(with: .opacity)` |
| Swipe card release | Spring back `.spring(response: 0.3, dampingFraction: 0.75)`. Fly-out linear 0.32 s. |
| Tab bar | System `.tabBarMinimizeBehavior(.onScrollDown)` |

## 9. Icons

SF Symbols at `.semibold` (spec §12): `link`, `folder`, `magnifyingglass`, `plus`, `list.bullet`,
`square.grid.2x2`, `arrow.up.right`, `square.and.arrow.up`, `star` / `star.fill`, `trash`, `pencil`,
`highlighter`, `tag`, `archivebox`, `checkmark.circle`, `ellipsis`, `sparkles`, `doc.on.clipboard`,
`arrow.uturn.backward`, `play.fill`, `cart`.

## 10. Accessibility checklist for every component

- `.accessibilityElement(children: .combine)` on tiles and rows, with label "Title, domain, favourite".
- Rotor actions on tiles and rows: Open original, Favorite, Move, Move to Trash.
- Under Increase Contrast, raise ink .45 → .60 and .50 → .65 for small text.
- Text on images: white, eyebrow at .85, with shadow `0 1 3` black .50.
