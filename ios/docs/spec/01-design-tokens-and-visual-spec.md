# AnyLink for iOS — Design tokens & visual spec

Source of truth for every colour, size, radius, shadow, blur and motion curve in the
AnyLink iOS app (SwiftUI). Every value here was taken from the current web app
(`src/app/globals.css` and the components in `src/components/`) and from the
original Claude Design exports in the repo root (`AnyLink Design Tokens.html`,
`AnyLink Screens.html`). Attach both HTML files next to this document as the visual
reference.

Where the shipped app and the mockups disagree, **shipped wins**. The mockup variant
is listed after it so either one can be chosen deliberately (see §14).

Snapshot: web app at commit `804973f` (2026-10-02, "mobile UX pass": bottom action
sheet, Undo toast, Links · List · Collections · Search tab bar, themed Add sheet).

---

## 0. Units and conversion rules

| Web | iOS | Rule |
|---|---|---|
| `px` | `pt` | **1 : 1**. A CSS px is a reference pixel, which equals one iOS point. |
| `letter-spacing: Xem` | `.tracking(size × X)` | Tracking is in points. Example: 22 × −0.03 = **−0.66 pt**. |
| `line-height: L` (unitless) | `.lineSpacing(size × L − font.lineHeight)` | SwiftUI adds spacing *between* lines. Leave single-line labels at the default. |
| `rgba(r,g,b,a)` | `Color(hex:).opacity(a)` | All colours are **sRGB**. |
| `border-radius: R` | `RoundedRectangle(cornerRadius: R, style: .continuous)` | Use the continuous (squircle) style everywhere. Capsules: `Capsule()`. |
| `box-shadow: x y B S color` | `.shadow(color:, radius: B / 2, x:, y:)` | SwiftUI has no spread value. A negative spread just makes the shadow sit slightly tighter; dropping it is acceptable. |
| `filter: blur(B)` (orbs) | `RadialGradient` (or `.blur(radius: B)`) | See §8. |
| `backdrop-filter: blur() saturate()` | `Material` + tint, or Liquid Glass | iOS has no public saturate control. See §6. |

Reference device for every diagram: **iPhone 402 × 874 pt** (16 Pro / 17 Pro class).
Safe area: top 62 pt, bottom 34 pt.

---

## 1. Colour

### 1.1 Core palette (theme-independent)

| Token | Hex | RGB | Use |
|---|---|---|---|
| `signal` (Signal orange) | `#FF5A1F` | 255 90 31 | Primary capture action (Add FAB, Fetch, Save), favourites ★, **active tab tint**, Undo, live state |
| `signalSoft` | `#FF7A45` | 255 122 69 | Signal pressed state, inline field error text |
| `lime` | `#D6F24B` | 214 242 75 | Confirm/selected: selection check, active size, progress fills, highlights, `<mark>`, Keep button, % readout |
| `limeHover` | `#E0F96A` | 224 249 106 | Lime pressed state |
| `periwinkle` | `#7C8CFF` | 124 140 255 | Ambient light, smart collections, "Product detected", price chart line |
| `slate` | `#9AA3AD` | 154 163 173 | Muted marker, the "Unsorted" inbox |
| `onAccent` | `#17181B` | 23 24 27 | Text/icons on lime or orange. **Stays dark in both themes.** |

> The token sheet's editable "accent" prop defaults to `#F0A000` (amber). That was a
> design-tool option, never shipped. Signal is **`#FF5A1F`**.

### 1.2 Theme colours (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#ECEEF0` | `#0F1012` | App background under every glass layer. Also the status-bar / browser-chrome colour. |
| `ink` | `#17181B` | `#ECEEF0` | Text, icons, primary (ink) buttons, active chips |
| `paper` | `#FFFFFF` | `#1A1B1F` | Opaque surfaces: **action sheet**, Reduce Transparency fallback |
| `surface` | `#FFFFFF` | `#24252A` | Translucent fills: cards, inputs, pills (always used with an alpha) |
| `rim` | `#FFFFFF` | `#3E4046` | Glass edges / hairline borders (always with an alpha) |
| `onInk` | `#F4F5F6` | `#17181B` | Text on an `ink` fill (buttons, toast) |
| `docShell` | `#0D0E10` | `#1C1D21` | Icon colour on the orange Add FAB. In design files it is also the dark backdrop of the canvas. |
| `glassTint` | `#FFFFFF` | `#1E1F23` | Fill of the `glass-42/55/70` recipes (§6). Not the same value as `surface` in dark mode. |
| `heroPlaceholder` | `#DFE2E5` | `#26272B` | Background of a hero slot while its image loads |

### 1.3 Ink alpha scale

Ink is **always** applied as an alpha over whatever sits beneath it. Never pre-mix greys.

| Alpha | Where it's used |
|---|---|
| **1.00** | Titles, primary text, active chip fill, action-sheet rows, Restore label |
| .80 | Reader body text |
| .75 | "Open" pill text on iPad cards, "Also in your library" titles |
| .70 | Note button label (no note yet), card trash icon |
| .65 | **Inactive tab icon + label**, inactive chip text, sidebar filter rows, sort select text |
| **.60** | Secondary buttons, close/theme icons, import step labels |
| .55 | Lead/description copy, product spec labels, empty-state body, "Move to…" back row |
| **.50** | Domain lines, counts, meta text, pending crawl-step number, Trash subtitle |
| **.45** | Sidebar counts, housekeeping rows, palette meta, placeholder copy |
| .40 | Eyebrow/section labels, search icon, previous price, "No tags yet" |
| .35 | Unset favourite in the detail header, note placeholder |
| .30 | **Action-sheet scrim**, resize-handle hatch, input placeholders |
| .25 | Drawer scrim, inactive onboarding step label, separator dot |
| **.20** | Dashed borders (paste hint) |
| .18 | Dashed drop zone in the Add sheet |
| .16 | Add-sheet field and outline-button borders |
| .15 | Action-sheet grabber |
| .12 | Size-switch island border, iPad "Open" pill border, Add-sheet progress track, size-segment border |
| .10 | Small input borders, crawl panel border, pending crawl-step badge |
| .08 | Pressed action-sheet row, housekeeping divider |
| **.06** | Chip/pill fill, active nav row, kbd fill, spec dividers, progress track |
| .05 | Add-sheet field fill, crawl panel, clipboard row, inactive size segment |
| .04 | Dead-link list background in onboarding |

Bold rows are the six official token steps (1, .6, .5, .45, .2, .06); the rest are
real values in the code.

### 1.4 Light-on-dark text

| Token | Value | Use |
|---|---|---|
| `light100` | `#F4F5F6` | Text on the always-dark bulk action bar |
| `light55` / `light45` / `light40` | `#F4F5F6` @ .55 / .45 / .40 | Defined, currently unused |

The Add sheet used to be a fixed dark panel (`#111214`, white @ .06 fields). It now
follows the theme (§9.7), so these tokens matter only for always-dark surfaces.

### 1.5 Semantic one-offs

| Purpose | Value |
|---|---|
| Destructive (light surfaces: action sheet, Trash "Delete") | `#EF4444` |
| Destructive on dark surfaces (bulk bar) | `#FF8A5C` |
| In stock dot / tint | `#00A046` dot, `#00A046` @ .14 fill |
| Notice (excerpt-only / failed crawl) | `#FF5A1F` @ .14 fill, text ink @ .55 |
| Link icon tile (Add sheet) | `#FF5A1F` @ .18 fill, icon `#FF8A5C` |
| "Product detected" chip | `#7C8CFF` @ .22 fill, 6 pt periwinkle dot |
| Modal scrim (Add sheet, Search) | `#0D0E10` @ .42 + 6 pt background blur |
| Image scrim on cards (theme-independent) | **black** @ .28 at the bottom → clear at 55 % |
| Image scrim on reader hero (theme-independent) | **black** @ .80 → black @ .35 → clear (bottom to top) |
| Text on images | white; eyebrow white @ .85 with text shadow `0 1 3` black @ .50 |
| Bulk action bar | `#17181B` solid (both themes) |
| Toast | `ink` fill, `onInk` text, Undo in `signal` |
| Highlight in reader | lime @ .60, radius 3 |
| Search match `<mark>` | lime @ 1.0, radius 3, text `onAccent` |

Image scrims use black rather than `ink`: ink turns light in dark mode and the white
title would disappear.

### 1.6 Collection colours

| Set | Values (in order) |
|---|---|
| Swatches offered when creating a collection | `#FF5A1F` · `#D6F24B` · `#7C8CFF` · `#9AA3AD` · `#E0855A` |
| Cycled for auto-made collections (onboarding) | `#FF5A1F` · `#7C8CFF` · `#D6F24B` · `#E0855A` · `#9AA3AD` · `#17181B` |
| Inbox "Unsorted" | `#9AA3AD` |
| Smart collections ("custom filters") | `#7C8CFF` |
| "All links" marker | `ink` |

`#E0855A` (terracotta) is the one colour that exists only as a collection/identity
tint.

### 1.7 Card identity (domain tint, stripe, initial)

Every link has a deterministic `tint`, `stripe` and `initial` derived from its domain.
The server stores them and applies the legibility fix on read, so **use the API's
values and don't recompute them**. The algorithm is here for offline previews:

```
TINTS   = [#FF5A1F, #7C8CFF, #D6F24B, #9AA3AD, #17181B, #E0855A]
STRIPES = [#FFFFFF, #17181B, #D6F24B]
h = 0; for each UTF-16 unit c of domain: h = int32(h * 31 + c)
n = |h|                       // use 64-bit abs: |Int32.min| overflows Int32
tint   = TINTS[n % 6]
stripe = STRIPES[n % 3]
if stripe == tint: stripe = (tint == #17181B) ? #FFFFFF : #17181B   // legibility fix
initial = uppercase(first char) or "?"
```

They're used for the **initial badge** (`initial` drawn in `stripe` on a `tint` fill)
and for the **hero fallback** shown when a link has no image (§9.5). The Swift version
in §15 matches the TypeScript output for ASCII, Unicode and int32-overflow domains.

---

## 2. Typography

### 2.1 Family

**Instrument Sans** (Google Fonts, SIL Open Font License, so it can be bundled).
Weights 400 / 500 / 600 / 700. Bundle the variable TTF, list it under `UIAppFonts`,
and use `Font.custom("InstrumentSans-Regular", size:, relativeTo:)` with
`.weight()`. Italic is not used.

- 400: body copy, meta
- 500: navigation, chips, default UI text (the web body default is **13.5 / 500**)
- 600: titles, buttons, labels, tab labels
- 700: badges, initials, the % change pill

Monospace (SF Mono via `.monospaced()`): only for query strings, keyboard hints, the
crawl % and dead-link status codes. Use `.monospacedDigit()` for counters.

### 2.2 Type scale: the eight official tokens

| Token | Size | Weight | Tracking (em → pt) | Line height | Dynamic Type anchor |
|---|---|---|---|---|---|
| Display | 56 | 600 | −.055 → **−3.08** | 1.02 | `.largeTitle` |
| Hero | 52 | 600 | −.055 → **−2.86** | 1.03 | `.largeTitle` |
| Title | 22 | 600 | −.03 → **−0.66** | default | `.title2` |
| Wordmark | 17 | 600 | −.035 → **−0.60** | default | `.headline` |
| Lead | 14.5 | 400 | 0 | 1.55 | `.callout` |
| Body | 13.5 | 500 | 0 | default | `.subheadline` |
| Meta | 11.5 | 400 | 0 | default | `.caption` |
| Eyebrow | 10.5 | 600 | +.14 → **+1.47**, UPPERCASE | default | `.caption2` |

Rule from the token sheet: **negative tracking on anything above 20 pt.**

### 2.3 Sizes used by components

| Role | Size / weight | Tracking pt | Notes |
|---|---|---|---|
| Page title ("All links", "Trash") | 30 / 600 | −1.65 | Hero token resized; line height 1.03 |
| Collection title | 26 / 600 | −0.78 | Title token resized |
| Reader hero title (white on image) | 28 / 600 | −0.84 | |
| Product title | 26 / 600 (28 on wide) | −1.04 | line height 1.10 |
| Product price | 28 / 600 (30 on wide) | −1.12 | |
| Card title L / M / S (iPad) | 27 / 19 / 17 · 600 | −1.03 / −0.72 / −0.65 | line height 1.12; 3 lines for L, 2 for M and S |
| Phone tile title | 13 / 600 | −0.26 | line height 1.12; **always 2 lines** |
| Phone row title | 14 / 600 | −0.28 | 1 line, truncated |
| Action-sheet row | 15 / 500 | 0 | |
| Action-sheet header title | 14 / 600 | 0 | + domain in Meta |
| Detail "Back" button (phone) | 15 / 600 | 0 | |
| Bottom "Open original" button | 15 / 600 | 0 | |
| Mockup lead-card title | 17 / 600 | −0.51 | line height 1.2 |
| Add sheet empty-state title | 18 / 600 | −0.63 | |
| "Reading the page…" | 15 / 600 | −0.45 | |
| Mobile add hero (mockup 4d) | 32 / 600 | −1.60 | line height 1.0 |
| Large primary button | 15 / 600 | −0.15 | |
| Button / pill label | 12.5–13.5 / 600 | 0 | |
| Chip / sort | 12 / 500 | 0 | |
| Search field | 15 / 400 | 0 | |
| Reader body | 15 / 400 | 0 | line height 1.7, paragraph spacing 20 |
| Card domain | 11.5 / 400 | 0 | ink @ .50 |
| Tile domain | 10.5 / 400 | 0 | ink @ .50 |
| Tab bar label | 10 / 600 | −0.10 | |
| Tag on hero | 10 / 500 | 0 | |
| Initial badge | 8 / 700 (14 pt badge), 9 / 700 (18 pt), 10 / 700 (22, 24 and 32 pt) | 0 | |

Accessibility note: Eyebrow (10.5), tab labels (10), tile domain (10.5) and badges
(8–9) sit below Apple's 11 pt guidance. Keep them as designed at the default size,
but anchor them with `relativeTo:` so they grow with Dynamic Type.

---

## 3. Spacing

### 3.1 Tokens

| Step | Value | Use |
|---|---|---|
| s1 | **8** | Icon to label, gap between chips |
| s2 | **14** | Inside chips, gap between header items |
| s3 | **18** | Card padding |
| s4 | **26** | Panel padding |
| s5 | **48** | Page gutter (desktop) |
| s6 | **70** | Hero inset (marketing) |

### 3.2 Phone layout values

| Where | Value |
|---|---|
| Screen side padding (headers, panels, trash list) | **16** |
| Page header | top = max(24, top safe area), bottom 16, gap 14 |
| Tile grid outer padding | 10 + 4 tile inset = **14** visible edge |
| Gap between tiles (both axes) | **8** (4 + 4 inset) |
| Row-list outer padding | 12 |
| Gap between rows | 4 |
| Card body padding (iPad card) | 16 horizontal / 14 vertical, 8 gap |
| Tile body padding | 10 horizontal / 8 vertical, 4 gap |
| Panel padding (onboarding, empty library) | 24 phone / 28 wide |
| Rail section padding | 16, gap 10 |
| Sidebar / drawer row | 12 horizontal, **12 vertical on phone** (10 on iPad), so rows reach 44 |
| Bottom spacer under scrolling content | 96 + bottom safe area (clears the tab bar or the bottom Open button) |

---

## 4. Corner radius

### 4.1 Tokens

| Token | Value | Use |
|---|---|---|
| `kbd` | **7** | Keyboard-hint chips, initial badges (22–24 pt) |
| `badge` | **9** | Logo-sized badges, variant swatches, clipboard-card icon |
| `nav` | **14** | Sidebar rows, action-sheet rows, onboarding inputs, notices |
| `card` | **22** | Library cards (iPad), rail sections, drop zones, preview card |
| `panel` | **27** | Glass panels (onboarding, empty library) |
| `pill` | **999** | Every interactive control: buttons, chips, fields, tab bar, toast |

### 4.2 Every radius in use

| Radius | Component |
|---|---|
| 30 | "Add a link" sheet (top corners only on phone, all four on iPad) |
| 28 | Reader / product article panel; **action sheet top corners** |
| 26 | Search palette panel |
| 24 | Mockup lead card (4d) |
| 22 | iPad library card, rail section, dashed drop zone, crawl panel, add-sheet preview card |
| 20 | Product image, mockup compact row, clipboard card |
| 18 | Hero image inset inside an iPad card, video placeholder, onboarding result card |
| 16 | **Phone tile**, trash row, popover menu |
| 14 | Sidebar row, **action-sheet row**, onboarding input, notice, add-sheet icon tile |
| 12 | **Phone row**, palette result row, add-sheet fields |
| 11 | Hero inset inside a phone tile |
| 10 | Size segment, collection-name input, alert field |
| 9 | Variant swatch |
| 8 | 32 pt initial badge ("Also in your library") |
| 7 | 22 / 24 pt initial badge, kbd |
| 6 | 18 pt initial badge, retailer badge |
| 5 | Small kbd |
| 4 | 14 pt initial badge (tile) |
| 3 | `<mark>` and highlight |
| 28 % of side | App-icon / logo tile |
| Circle | Collection marker, FAB, icon buttons, selection check, grabber ends |

Nested rule: the inner radius is roughly the outer radius minus the inset
(tile 16 → hero 11 at 6 inset; card 22 → hero 18 at 8 inset).

---

## 5. Control sizes

| Control | Size | Shape / fill |
|---|---|---|
| Large primary button | h **52**, padding 0 30, 15/600 | Capsule, `ink` fill, `onInk` text; pressed `#26282D` |
| Bottom "Open original" (phone detail) | h **52**, full width minus 16 + 16 | Capsule, `ink`, 15/600, ↗ 15, window shadow |
| Primary button | h **48** (onboarding) / 46 (Save) | Capsule, `ink` or `signal` |
| Accent button | h **44**, padding 0 22, 13/600 | Capsule, lime fill, `onAccent` text |
| Glass button | h **44**, padding 0 22, 13/600 | Capsule, white @ .70, border white @ .90 |
| Action-sheet row | h **48**, padding 0 14, gap 12, icon 15 | r14, transparent; pressed ink @ .08 |
| Header action pill | h **40** phone / 36 iPad, padding 0 16, 12.5/600 | Capsule, surface @ .70, border rim @ .90 |
| Header icon button | **40 × 40** phone / 36 iPad | Circle, same fill |
| Close / theme button | **44 × 44** phone / 36 iPad | Circle, transparent, ink @ .60 |
| Sort select | h **40** phone / 32 iPad, padding left 14 / right 32, 12/500 | Capsule, ink @ .06, chevron 10 pt `#8A8F96` stroke 3 |
| Round icon button (token sheet) | **40 × 40**, icon 15, stroke 2.6 | Circle, glass .70 |
| URL field | h **46** (sheet) / 52–58 (mockup) | Capsule; kbd hint on the right in mockups |
| Search pill (mockup) | h **44**, padding 0 16, 14 pt | Capsule, white @ .75, border white @ .90 |
| Mockup collection chip | h **34**, padding 0 14, 12.5 | Capsule; active = ink fill with the count at .55 opacity |
| Chip | padding 6 × 12, 12/500 | Capsule, ink @ .06 / active ink |
| Tab bar item | h **50** | Capsule (pressed scale .90) |
| Add FAB | **56 × 56** | Circle, signal |
| Tile ⋯ button | 28 visible, **44 × 44 hit area** | Circle, surface @ .85 + blur 8 |
| Size segment (S/M/L) | 28 × 28 (card) / h 36 (form) | Circle / r10 |
| Selection check | 24 × 24 | Circle |
| Collection marker | 8 (lists), 10 (action-sheet move list), 14 (collection header) | Circle |
| Toast Undo | h **36**, padding 0 16, 600 | Text button in signal |

Token-sheet control heights: **36 / 44 / 52 / 58**. Minimum touch target on iOS:
**44 × 44**, everywhere, even where the visual is smaller. The web mobile pass already
moved every phone control to 40–44.

---

## 6. Surfaces: glass recipes

The identity of the product is **translucent surfaces over blurred colour**.
Accents mark things, they never fill large areas.

### 6.1 Web recipes (exact)

| Recipe | Fill (light) | Fill (dark) | Border (light / dark) | Backdrop | Used for |
|---|---|---|---|---|---|
| `glass-42` | white @ .42 | `#1E1F23` @ .42 | white @ .80 / white @ .08 | blur 20, saturate 1.4 | Chrome bars |
| `glass-55` | white @ .55 | `#1E1F23` @ .55 | same | blur 24, saturate 1.4 | Panels (onboarding, empty library) |
| `glass-70` | white @ .70 | `#1E1F23` @ .70 | same | blur 28, saturate 1.4 | Controls, search palette |

Token-sheet rule: the border is one step brighter than the fill
(.42 → .60, .55 → .80, .70 → .90). Blur 16–28. **Never stack two glass layers
directly on top of each other.**

### 6.2 Component surfaces (built on `surface` and `rim`)

| Component | Fill | Border | Backdrop |
|---|---|---|---|
| Library card / phone tile / row | surface @ **.62** | rim @ .75, 1 pt (selected: **ink 2 pt**) | blur 22, sat 1.35 |
| Reader / product article | surface @ .72 | rim @ .85 | blur 22 |
| Rail section | surface @ .55 | rim @ .80 | blur 20, sat 1.4 |
| Detail header (sticky) | surface @ .45 | bottom rim @ .60 | blur 24, sat 1.3 |
| Sidebar (iPad) | surface @ .55 | right rim @ .80 | blur 24, sat 1.4 |
| Collections drawer (phone) | **solid `canvas`** | — | — plus window shadow |
| Tab bar capsule and FAB | surface @ .42 | rim @ .55 | blur 20, **sat 1.8**, specular top edge (§7) |
| Size-switch island (iPad hover) | surface @ .96 | ink @ .12 | blur 10 |
| Tile ⋯ button | surface @ .85 | — | blur 8, small shadow |
| **Action sheet** | **solid `paper`** | — | window shadow, scrim ink @ .30 |
| **Add sheet** | **solid `canvas`** + "sheet" orbs | — | window shadow; sticky header canvas @ .45 + blur 24 |
| **Toast** | **solid `ink`** | — | popover shadow |
| Popover menu (iPad ⋯) | surface @ .90 | — | popover shadow |
| Search palette (phone) | solid `canvas` under glass-70 | rim @ .60 dividers | — |

### 6.3 iOS mapping

1. **Navigation layer** (tab bar, toolbars, search field, floating Add button, bulk
   toolbar): use **system Liquid Glass** (iOS 26+). `TabView` and toolbars get it
   automatically. For custom floating controls use `.glassEffect(.regular, in: .capsule)`,
   and tint the Add button `.glassEffect(.regular.tint(.signal).interactive())`. Group
   neighbouring glass controls in a `GlassEffectContainer`. The web tab bar already
   imitates this ("press squishes the tab like Liquid Glass does").
2. **Content layer** (cards, tiles, panels, rail sections, the article): **don't** use
   Liquid Glass. Apple reserves it for controls that float above content. Use the
   frosted-surface modifier below.
3. **Sheets** (link actions, Add a link): system sheets (`.sheet` +
   `.presentationDetents`). On iOS 26 they get Liquid Glass backgrounds automatically.
   That replaces the web's solid paper/dark backgrounds, which were stand-ins.
4. **Reduce Transparency** (`accessibilityReduceTransparency`): every frosted surface
   becomes solid `paper`. The web app does the same with
   `prefers-reduced-transparency`.
5. **No stacking**: a frosted card never sits on a frosted panel. Inside glass, use
   flat ink @ .06 fills.

```swift
struct Frosted: ViewModifier {
    var fill: Double          // .42 / .55 / .62 / .70 / .72
    var rim: Double = 0.75
    var radius: CGFloat = 22
    @Environment(\.accessibilityReduceTransparency) private var solid

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content
            .background {
                if solid { shape.fill(AL.paper) }
                else { shape.fill(.ultraThinMaterial).overlay(shape.fill(AL.surface.opacity(fill))) }
            }
            .overlay(shape.strokeBorder(AL.rim.opacity(rim), lineWidth: 1))
    }
}
```

The material plus the surface tint approximates `blur + saturate + fill`. Calibrate
against the web app side by side with the same orbs behind it. If a surface reads
too milky, lower the tint by about .1 and keep the border value.

---

## 7. Elevation

| Token | CSS (light) | CSS (dark) | SwiftUI (radius = blur ÷ 2) |
|---|---|---|---|
| `card` | `0 2 8 −2` ink @ .14 | black @ .50 | `.shadow(color: ink.opacity(0.14), radius: 4, y: 2)` |
| `popover` | `0 14 34 −12` ink @ .28 | black @ .60 | `.shadow(color: ink.opacity(0.28), radius: 17, y: 14)` |
| `window` | `0 30 70 −20` ink @ .45 | black @ .75 | `.shadow(color: ink.opacity(0.45), radius: 35, y: 30)` |

In dark mode, swap `ink` for `.black` at the dark alpha.

One-off shadows:

| Where | Value |
|---|---|
| Add-a-link sheet | `window` |
| Sticky Save button in the Add sheet | `0 10 30` black @ .45 |
| Action sheet | `window` |
| Toast | `popover` |
| Bottom "Open original" button | `window` |
| Size-switch island | `0 4 14` black @ .18 **plus** `0 1 3` black @ .12 |
| Product image | `0 10 26 −14` ink @ .40 |
| Dragged (lifted) tile | `0 14 22` ink @ .22, plus scale 1.05 |
| Tab bar / FAB | `popover`, plus inner highlights: top edge white @ .45 (1 pt), bottom edge black @ .05 (Liquid Glass provides these natively) |

---

## 8. Ambient light (blurred colour orbs)

Soft blobs of colour sit under the glass so the frosted surfaces have something to
frost. Opacity **.22–.40**, blur **90–150**. They're absolutely positioned, ignore
touches, and are clipped by the screen. **In dark mode every variant renders at 45 % of
its opacity**, because at full strength the colours mix to olive and brown on the dark
canvas.

### 8.1 Variants

| Variant (screen) | Orbs (`left/right/top/bottom` offset · size · colour · opacity · blur) |
|---|---|
| **Phone library** (mockup 4d, recommended on iPhone) | L −90, T −60 · 300 · signal · .30 · 90 ／ R −80, T 340 · 280 · periwinkle · .26 · 100 |
| **Phone add-a-link** (mockup 4d) | L −80, T −70 · 300 · signal · .32 · 90 ／ R −90, T 200 · 300 · lime · .34 · 110 |
| Library (web, desktop-sized) | L −140, T −120 · 520 · signal · .34 · 120 ／ R −100, T 180 · 460 · lime · .40 · 130 ／ R 280, B −180 · 520 · periwinkle · .22 · 140 |
| Reader | L −140, T −160 · 520 · signal · .28 · 130 ／ R −150, B −180 · 520 · periwinkle · .24 · 140 |
| Product | L −150, T −150 · 520 · periwinkle · .26 · 130 ／ R −140, B −170 · 520 · lime · .30 · 140 |
| Sheet (inside the Add sheet) | L −60, T −80 · 380 · signal · .35 · 110 ／ R −80, B 40 · 340 · periwinkle · .28 · 120 |

On iPhone use the 4d phone values. The web app reuses the 520 pt desktop orbs on
phones, which floods a 402 pt screen. On iPad use the desktop variants.

### 8.2 iOS implementation

Use a **`RadialGradient`** for each orb, not `.blur()` on a circle. A 120 pt Gaussian
blur on a 520 pt layer is expensive on every frame:

```swift
RadialGradient(colors: [color.opacity(opacity), color.opacity(0)],
               center: .center, startRadius: 0, endRadius: size / 2 + blur)
    .frame(width: size + blur * 2, height: size + blur * 2)
    .offset(...)               // per the table
    .opacity(colorScheme == .dark ? 0.45 : 1)
    .allowsHitTesting(false)
    .accessibilityHidden(true)
```

Orbs stay still. They don't animate or follow scroll.

---

## 9. Component anatomy (phone)

All measurements in pt on the 402 pt reference device.

### 9.1 Library screen

```
┌────────────────────────────────────────────┐
│ ░░ status bar / Dynamic Island (safe 62) ░ │
│                                            │
│  All links                      [Newest ⌄] │  header: pad 16 · top max(24, safe)
│  └30/600/−1.65                  └sort h40  │  count is hidden on phone
│ ┌───────────────────┐ ┌───────────────────┐│  2-up tile grid
│ │      tile         │ │      tile         ││  visible tile 183 × 124
│ └───────────────────┘ └───────────────────┘│  gaps 8 · outer edge 14
│ ┌───────────────────┐ ┌───────────────────┐│
│ │                   │ │                   ││
│ └───────────────────┘ └───────────────────┘│
│               (scrolls under)              │
│ ╭──────────────────────────────╮ ╭──────╮  │  tab bar, bottom = max(12, safe 34)
│ │  ⛓     ☰      ▭         ⌕    │ │  ＋  │  │  slides away while scrolling down
│ │Links  List Collections Search│ ╰──────╯  │
│ ╰──────────────────────────────╯           │
└────────────────────────────────────────────┘
```

- Query active (from a filter or a saved search): a **query chip** follows the title:
  ink fill, mono 11 pt `onInk` text, ✕ at 60 %. Tap clears it.
- Empty library: a `glass-55` panel, r27, pad 28: Title "Start with the links you
  already have", Lead copy (ink .55, max 440), ink button h44 "Import my links".

### 9.2 Phone tile (2-up grid)

```
◄──────────────── 183 ────────────────►
╭─────────────────────────────────────╮  r16 · surface .62 · rim .75 1pt · card shadow
│ ╭─────────────────────────────────╮ │  hero: inset 6 (top/left/right), h54, r11
│ │                              (⋯)│ │  ⋯: 28 visual, 8 from top and right edges,
│ │      hero image / fallback      │ │  44×44 hit area anchored to the corner
│ ╰─────────────────────────────────╯ │  scrim: black .28 at bottom → clear at 55%
│  ▣ nasa.gov                     ★   │  pad 10/8 · badge 14×14 r4 8/700 · 10.5 ink.50 · ★ 11 signal
│  A full NASA space suit costs       │  13/600 −0.26 · line height 1.12 · 2 lines
│  $12 million                        │
╰─────────────────────────────────────╯  total height 124 (grid row 132 incl. 4+4 inset)
```

- On iPhone, every size (S/M/L) renders as this same tile. Size only changes the
  layout on iPad (§10).
- Tap → link detail. **⋯ → action sheet** (§9.4).
- Selected (in selection mode): the border becomes **2 pt ink**, and a **24 pt lime
  circle with an ink ✓** appears top-left at 12/12.
- Being dragged: the slot fades to 35 %; the lifted copy scales to 1.05 with the drag
  shadow.

### 9.3 Phone row (list mode, from the List tab)

```
◄──────────────────────── 378 (screen − 24) ────────────────────────►
╭────────────────────────────────────────────────────────────────────╮ h44 · r12
│ ▣  How the shuttle refit bay was rebuilt from…           ★    (⋯) │
╰────────────────────────────────────────────────────────────────────╯
 pad-left 10, pad-right 44 · badge 22×22 r7 10/700 · gap 8 · title 14/600 −0.28, 1 line
 ★ 11 signal · ⋯ 28 visual centred in a 44 hit area flush right
 rows stack with 4 between them (grid row 48 incl. 2+2 inset)
```

### 9.4 Link action sheet (from ⋯ on a tile or row)

```
scrim: ink .30, tap to close · sheet rises from the bottom, 0.28 s
╭──────────────────────────────────────────────────────────────────╮ paper · top r28
│                           ━━━━                                   │ grabber 36×4 ink .15, mb 8
│  ▣  A full NASA space suit costs $12 million                     │ badge 24 r7 · 14/600
│     nasa.gov                                                     │ meta ink .50 · pad 14, pb 8
│  ↗   Open original                                               │ rows h48 · r14 · pad 14
│  ⇪   Share…                       (only where sharing exists)    │ gap 12 · icon 15
│  ⛓   Copy link                     → toast "Link copied"         │ 15/500 ink
│  ▭   Move to collection            (if another collection exists)│
│  ★   Add to favorites / Remove from favorites   (★ in signal)    │
│  🗑   Move to Trash                 (#EF4444)    → toast + Undo   │
╰──────────── pad 12 sides, bottom max(12, safe) ─────────────────╯

Move to collection → the list swaps in place (max height 50 % of the screen, scrolls):
│  ←  Move to…            (ink .55; goes back)                     │
│  ●  Reading             (10 pt colour dot)  → toast "Moved to Reading" │
│  ●  Design                                                       │
```

iOS: present with `.sheet` + `.presentationDetents([.medium, .large])` +
`.presentationDragIndicator(.visible)`, or a `.contextMenu` on long press (which also
gives a lifted preview, §features 4.5). Use `ShareLink` for Share.

### 9.5 Hero fallback (link without an image)

```
╭──────────────────────────────╮
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  background = tint
│                              │  horizontal bands in `stripe`: 6 on / 13 off
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  (period 19, starting at the top edge)
│         ╭──────────╮         │
│▓▓▓▓▓▓▓▓▓│  circle  │▓▓▓▓▓▓▓▓▓│  centred circle Ø170 in `stripe` @ .28
│         ╰──────────╯         │
╰──────────────────────────────╯
```

While a real image loads, the slot shows `heroPlaceholder`.

### 9.6 Tab bar

```
 12 ◄────────────────── flexible ──────────────────► 10 ◄── 56 ──► 12
 ╭─────────────────────────────────────────────────╮   ╭────────╮
 │   ⛓         ☰          ▭              ⌕         │   │   ＋   │
 │  Links     List    Collections      Search      │   │        │
 ╰─────────────────────────────────────────────────╯   ╰────────╯
  capsule: pad 4 × 3, items h50 equal width,           FAB: circle 56, signal fill,
  icon 21 stroke 2.4, gap 3, label 10/600/−0.1         icon 21 in docShell colour,
  active tab = signal, others ink .65                  same glass border and shadow
  press scale .90 over 0.2 s · bottom = max(12, safe)
```

- **Links** (chain icon) is active on All links when the drawer is closed.
- **List / Grid** appears only on All links on a phone. It's a layout switch rather
  than a destination, and it's labelled with the layout a tap switches to: in grid
  mode it shows a list icon and "List", in list mode a grid icon and "Grid". It's
  never tinted.
- **Collections** (folder icon) opens the collections drawer. It's active while the
  drawer is open, on any collection page and on Trash.
- **Search** opens search and is active while it's open.
- **＋** opens Add a link.
- **Hide on scroll**: scrolling down more than 8 pt (below 80 pt from the top) slides
  the bar out (y + its height + 40, 0.3 s). Any upward scroll brings it back.
- Gestures (phone web): swipe right opens the drawer. Swipe left closes the drawer if
  it's open, otherwise it opens Add a link. A swipe needs 70 pt of horizontal travel
  and must be at least twice as wide as it is tall. Swipes starting within 24 pt of a
  screen edge (the system back gesture) or inside horizontal scrollers are ignored.

### 9.7 Add a link sheet (themed)

```
scrim: docShell .42 + blur 6 · tap outside to close
phone: bottom sheet, top corners r30, max height = screen − top safe − 12 · iPad: centred, r30
╭ bg canvas · "sheet" orbs · window shadow ───────────────────────────────╮
│ ┄ sticky header: canvas @ .45 + blur 24 · pad 24 / 24 / 8 ┄             │
│ Add a link (Title 22/600/−0.66 ink)        ⌘V ANYWHERE (iPad)  ( ✕ 40 ) │
│ ( https://                                                     ) h46    │ field: full width on phone,
│ (        Paste        ) (          Fetch          )             h46     │ ink .05 fill, ink .16 border
│   outline ink .16, 13/500    signal fill, onAccent 13/600               │ buttons split 50/50 on phone
│                                                                          │
│ IDLE ╭ dashed ink .18 · r22 · pad 26 × 30 · gap 14 ──────────────────╮   │
│      │ [46×46 r14 orange .18 + link icon #FF8A5C 22]                 │   │
│      │ Nothing to read yet           18/600/−0.63 ink                │   │
│      │ Drop in any URL. The crawler pulls…  13 / lh 1.6 / ink .55     │   │
│      │ ╭ r14 ink .05 · pad 16 × 12 ──────────────────────────────╮    │   │
│      │ │ On your clipboard (signal)  nasa.gov/space-suit… (ink .55)│   │   │
│      │ ╰─────────────────────────────────────────────────────────╯    │   │
│      ╰───────────────────────────────────────────────────────────────╯   │
│ CRAWLING ╭ r22 · ink .05 · border ink .10 · pad 24 · gap 18 ─────────╮   │
│          │ Reading the page… (15/600/−0.45)          50 % (mono signal)│ │
│          │ ━━━━━━━━━━━━━━━──────────────  h5, track ink .12, fill lime  │  │
│          │ (✓) Fetching page        badge 18: done = lime fill, onAccent ✓│ │
│          │ (2) Reading content      pending = ink .10, number ink .50   │  │
│          ╰────────────────────────────────────────────────────────────╯   │
│ READY (one column on phone, two from 768 wide)                           │
│   "Refining title, summary and tags…" (12.5 ink .55, while the AI pass runs)│
│   [notice r14 orange .14, 12.5 ink .55]  excerpt-only or failed copy     │
│   ╭ preview card r22 surface .62 ─╮   TITLE    [ h42 r12 field ]         │
│   │ hero h170 (h56 tint strip on  │   EXCERPT  [ grows 86 → 192 ]        │
│   │  phone when there's no image) │   TAGS     (lime pills ✕) [h38 field]│
│   │ ▣ domain  (11.5 ink .50)      │            ( + suggestion ) outline  │
│   │ Title 17/600/−0.65            │   COLLECTION [ picker h42 r12 ]      │
│   ╰───────────────────────────────╯   CARD SIZE * [S][M][L] h36 r10      │
│   (✓ lime 18) Crawled — check the details (12, ink .55)                  │
│                         size: active lime / onAccent · others ink .05 / ink .60, border ink .12│
│  ┄ sticky on phone, bottom max(12, safe), shadow 0 10 30 black .45 ┄     │
│                                      (      Save to library      ) h46   │
╰──────────────── bottom padding max(24, safe area) ──────────────────────╯
 all fields: ink .05 fill, ink .16 border, 13.5 ink · labels = Eyebrow ink .40
 tag suggestions: outline ink .16, 11.5 ink .55, "+" in signal · picked tags: lime pill, ✕ ink .45
 collection error: border signal + "Pick a collection to save into." 11 pt signalSoft
```

Earlier builds drew this sheet as a fixed dark panel (`#111214`, white @ .06 fields,
lime accents). It now follows the app theme. Mockup 4d's light full-screen version is
described in the features document (§4.1). §14 has the decision note.

### 9.8 Search (command palette)

```
scrim docShell .42 + blur 6 · on phone the panel is top-aligned at max(12, safe top), 12 from the sides
╭ r26 · glass-70 over solid canvas · window shadow ───────────────────────╮
│ ⌕  Search links, #tags…                                       15 pt     │ pad 20 × 16
├─────────────────────────────── rim .60 ─────────────────────────────────┤
│ LINKS                                                (eyebrow ink .40)  │
│ ▌A full NASA [space] suit costs…                    nasa.gov (meta .45) │ row r12 pad 12×10
│  Floating water in deep [space]                     arxiv.org          │ active = ink .06
│  Show all 23 matches                                in the library      │
│ TAGS & COLLECTIONS                                                      │
│  # [space]                                                              │
│  [Space] stuff                                                          │
╰─────────────────────────────────────────────────────────────────────────╯
 [space] = <mark>: lime fill, r3, onAccent text · max height 50 % of the screen
 "No matches." centred, body ink .45, pad 32
```

### 9.9 Link detail (reader), phone

```
╭ sticky header: surface .45, blur 24 sat 1.3, bottom rim .60 ─────────────╮
│ pad 16 × 12, top = max(12, safe top)                                     │
│ ‹ Back                                       (★ 40)  ( Note h40 )  (⋮ 40)│
│ 18 chevron + 15/600 ink, h44                  ★ signal / ink .35          │
╰──────────────────────────────────────────────────────────────────────────╯
 [note panel when open: surface .45 band, textarea r14 surface .70, 3 rows]
 pad 16 × 24, gap 24
╭ article r28 · surface .72 · rim .85 ─────────────────────────────────────╮
│ ╭ hero h250 · scrim black .80 → .35 → clear (bottom to top) ─────────╮   │
│ │                                                                    │   │
│ │ NASA.GOV (eyebrow white .85 + text shadow)           pad 24        │   │
│ │ A full NASA space suit costs $12 million  (28/600/−0.84 white)     │   │
│ ╰────────────────────────────────────────────────────────────────────╯   │
│   body: max width 600, pad 24 × 32, 15 / lh 1.7 / ink .80, ¶ gap 20     │
│   …text with a [highlighted passage] (lime .60, r3)…                     │
╰──────────────────────────────────────────────────────────────────────────╯
╭ rail section r22 · surface .55 · rim .80 · pad 16 · gap 10 ─────────────╮
│ SAVED METADATA                                                           │
│ Domain                                                         nasa.gov  │ 13 pt: label ink .50 / value 500 ink
│ Saved                                                          9/18/2026 │
│ Reading time                                                    14 min   │
╰──────────────────────────────────────────────────────────────────────────╯
 TAGS (chips) · ALSO IN YOUR LIBRARY  [See all] (rows: badge 32×32 r8 + title)
 spacer 96
 ╭────────────────────────────────────────────────────────────────────╮  fixed, 16 from sides,
 │                    Open original  ↗                               │  bottom max(12, safe)
 ╰────────────────────────────────────────────────────────────────────╯  h52 ink · window shadow
```

- Products say "Open on {retailer}" (the first domain label, e.g. "Open on rozetka").
- iPad header instead: breadcrumb "‹ Library › Reading" (13 pt, collection name 600
  ink), a "Product detected" chip, and an "Open original" pill next to Note.
- Selecting text in the article shows a **Highlight** pill 42 pt above the selection:
  ink fill, a 6 pt lime dot, 11.5/600 `onInk`.
- ⋮ opens "Add to collection" (popover r16, surface .90, popover shadow, 224 wide,
  eyebrow header, rows 13 pt).

### 9.10 Product detail, phone

```
header as in 9.9 · bottom button "Open on rozetka ↗"
╭ article r28 surface .72 ─────────────────────────────────────────────────╮
│ [product image: full width × 200, r20, white bg, image shadow]          │ pad 20
│ [R] rozetka.com.ua · code 123456   badge 20×20 r6 white 10/700, 11.5 ink .50│
│ Apple iPhone 17 Pro Max 256 GB Silver           26/600/−1.04 lh 1.1      │
│ ₴54,999   ₴61,999   (−11% since saved)  28/600 · 15 ink.40 strike · lime pill 11.5/700 │
│ (● In stock) (Delivery tomorrow) (4.8 ★ · 1,204 reviews) (Warranty 1 yr) │
│   chips pad 6×12 12/500 ink .06; in-stock: green .14 + green dot         │
│ [■][■][■] variant swatches 30×30 r9, first one ringed 2pt ink + 4pt surface│
├──────────────────────────────────────────────────────────── ink .06 ────┤
│ ● SPECS ANYLINK PULLED                         8 of 38 shown · show all  │
│ Display ................................................ 6.9″ OLED     │ 13 pt, row pad 10,
│ Storage ................................................ 256 GB        │ divider ink .06
╰──────────────────────────────────────────────────────────────────────────╯
╭ rail: PRICE HISTORY ─────────────────────────────────────────────────────╮
│  ╱╲__╱‾‾╲_   periwinkle line 2.4, points r2.6 · min / max labels 11 ink .40│
│ ─────────── (proposed: threshold RuleMark, dashed)                       │
│ Alert me under   ₴ [ 50000          ]   field h36 r10 surface .70        │
╰──────────────────────────────────────────────────────────────────────────╯
```

### 9.11 Collection view and bulk bar

```
 ● Reading   12 links   [#design is:favorite]       [Newest ⌄]  ← marker 14 · 26/600/−0.78 · meta ·
                                                                  mono chip (smart only) · sort on the right
 Grouped because you said you're learning Rust…  ← reasoning, Lead ink .50, max 560 (auto-made only)
 [All] [rust] [async] [design] [cooking] →      ← chips scroll sideways and run off the right edge
 … tile grid …
            ╭ bulk bar: ink #17181B solid, capsule, pad 12×8, gap 8, window shadow ╮
            │ (3 selected) (Move to… ⌄) (Tag) (Archive) (Delete) ( ✕ )            │
            ╰─ chips h32 white .10, 12.5/500–600 #F4F5F6 · Delete text #FF8A5C ────╯
              pinned 24 above the bottom, centred
```

### 9.12 Trash

```
 Trash   18 links                                   ( Empty trash h40 )
 Links stay here until you delete them.            ← meta ink .50
╭ r16 · surface .62 · rim .75 · pad 6 / 6 / 6 / 16 · gap 8 ───────────────╮
│ ▣  Title of the deleted link…                 ( Restore )   ( Delete )  │
╰─────────────────────────────────────────────────────────────────────────╯
 badge 22 r7 · body 13.5 · Restore: h40 pill ink .06, 12.5/600 ink
 Delete: h40 text button 12.5/600 #EF4444 (deletes forever, no confirm)
 Empty trash: first tap → "Delete them for good?", second tap empties
 empty state: "Nothing here. Deleted links land in Trash until you empty it." (body ink .45)
```

### 9.13 Collections drawer (phone) / sidebar (iPad)

```
 [logo 48] AnyLink (wordmark)            ( ☾ 44 ) ( ✕ 44 )   ← ✕ on phone only
 ● All links                                 214     row r14 · pad 12 × 12 (10 on iPad) · gap 10
 ● Unsorted                                   31     active row: ink .06 fill
 ● Reading                                    12     marker 8 circle · count meta ink .45
 ● Design                                      8
 +  New collection                                   ink .50
 ↓  Import links
 FILTERS                                             eyebrow ink .40, top margin 16
   Favorites 9 · Articles 140 · Videos 22 · Products 6 · With a note 4 ·
   Untagged 51 · Duplicates 2 · Broken links 7 · Archived 3   (only if count > 0)
 CUSTOM FILTERS      ● Rust videos  5   (smart collections, draggable)
 SUGGESTED COLLECTIONS   Design 7  [Create] [✕]
 › TAGS 12           (collapsed; opens to #tag rows)
 ⌫  Trash                                      18
 ───────────────── ink .08 ─────────────────          housekeeping, quiet rows:
 ⌦  Delete empty collections          → "Removed 3"   meta size, ink .45, pad 12 (8 iPad)
 ▶  Guided tour
```

Phone drawer: 280 wide, solid canvas, window shadow, scrim ink .25, slides from the
left in 0.3 s. iPad: 250 wide, frosted (surface .55), always visible.

New-collection form (inline): ink .06 panel r14 pad 10 · name field h32 r10 ·
5 swatch dots 20 pt (selected: 2 pt ink ring + 3 pt surface gap) · Cancel /
**Add** (ink pill).

### 9.14 Toast

```
            ╭──────────────────────────────────────────────╮
            │  Moved to Trash                      Undo    │  ink capsule · pad 8 / 8 / 8 / 20
            ╰──────────────────────────────────────────────╯  body 13.5 onInk · Undo h36 600 signal
 16 from the sides · max width 384 · centred · 84 + safe area above the bottom (clears the tab bar)
 popover shadow · disappears after 5 s · a new toast replaces the old one
```

Messages: "Moved to Trash" / "{n} links moved to Trash" (both with Undo, which restores
them), "Moved to {collection}", "Link copied", "Couldn't copy the link".

---

## 10. iPad / wide layouts: the mosaic

Column count follows the **window width** (web breakpoints):
**≥1280 → 4 · ≥900 → 3 · ≥640 → 2 · otherwise the phone tiles**.
The layout is a dense-packed grid with 4 pt rows (cards fill holes left by bigger
neighbours). In SwiftUI that needs a custom `Layout`, because `LazyVGrid` can't span.

| Size | Columns | Height (incl. 6–7 inset) | Hero | Title |
|---|---|---|---|---|
| **S** | 1 | **180** | none (tag chip in the body) | 17/600/−0.65, 2 lines |
| **M** | 1 | **300** | fills the space above the body, inset 8, r18 | 19/600/−0.72, 2 lines |
| **L** | 2 | **300** | same | 27/600/−1.03, 3 lines |

Card details (iPad): r22, inset 6 (7 from 640 wide), body pad 16 × 14 gap 8, 18 pt
initial badge r6, domain 11.5 ink .50, an always-visible **Open** pill (h28,
border ink .12, surface .70, 11.5/600 ink .75, ↗ 12) next to the domain, first tag
as a chip on the hero (surface .75, 10/500, top-left 10).

Pointer hover (iPad trackpad) shows two **islands** on the right edge (stacked
top/bottom; on S they lie flat bottom-right): the **S·M·L switch** (28 pt circles,
active ink/onInk, hover lime) and **★ / trash**. A diagonal-hatch **resize handle**
(30 × 30, bottom-right) drag-resizes the card. Snap rule: width beyond 1.45 columns
→ L, else height above 245 → M, else S. While dragging, the card rubber-bands up to
±5 % toward the finger and settles with the release curve (§11). Hovering lifts a
card by 2 pt.

On touch-only iPad, sizes live in the context menu (features §4.5).

---

## 11. Motion

| Interaction | Duration | Curve (cubic-bezier) | SwiftUI |
|---|---|---|---|
| **Card entrance** (library load) | 0.70 s | (.22, 1.35, .36, 1) | `.timingCurve(0.22, 1.35, 0.36, 1, duration: 0.7)` |
| ↳ start scale per index | cycle **.72, 1.14, .86, 1.22, .64, 1.06**; opacity 0 → 1 | | |
| ↳ stagger | 35 ms × index, **capped at 600 ms** | | |
| Action sheet in | 0.28 s | (.2, .9, .3, 1), from y = +100 % | system sheet presentation |
| Tab bar hide / show | 0.30 s | ease | `.easeInOut(duration: 0.3)` on offset |
| Reorder (neighbours slide) | 0.26 s | (.2, .9, .3, 1.15) | `.timingCurve(0.2, 0.9, 0.3, 1.15, duration: 0.26)` |
| Drop settle | 0.22 s | (.2, .9, .3, 1.15) | same curve, 0.22 |
| Resize release | 0.40 s | (.2, 1.5, .4, 1) | `.timingCurve(0.2, 1.5, 0.4, 1, duration: 0.4)` |
| Tab / FAB press | 0.20 s | ease | scale .90 (`ButtonStyle` reading `isPressed`) |
| Drawer slide | 0.30 s | ease | or the system sidebar transition |
| Crawl progress bar | 0.50 s | ease | `.easeInOut(duration: 0.5)` on width |
| Link-check progress | 0.30 s | ease | |
| Toast | appears instantly, auto-hides after **5 s** | | `.transition(.move(edge: .bottom).combined(with: .opacity))` |
| Card hover lift (iPad pointer) | ~0.15 s | ease | y −2 |
| Selected-state opacity | 0.15 s | ease | |

Touch reorder (keep this behaviour): a **300 ms hold** picks the item up and plays a
**light haptic** (`.sensoryFeedback(.impact(weight: .light))`). Moving more than
**8 pt** before the hold completes cancels the pickup, so it counts as a scroll. The
lifted item follows the finger at scale 1.05. Within **90 pt** of the top or bottom
edge the list auto-scrolls by 10 pt per frame.

**Reduce Motion**: drop the entrance animation (render cards at their final state)
and use cross-fades instead of scale overshoots.

---

## 12. Iconography

The web app uses inline SVG: 24 × 24 viewBox, **round caps and joins, stroke 2.2–2.8**
(2.6 at the 14 pt default; lighter when larger). On iOS use **SF Symbols** at
`.semibold` weight, which is the closest match to a 2.6 stroke.

| Meaning | Web glyph | SF Symbol |
|---|---|---|
| Add | plus | `plus` |
| Search | magnifier | `magnifyingglass` |
| Links (library tab) | chain | `link` |
| Collections (tab) | folder | `folder` |
| Grid / List layout tab | 2 × 2 squares / 3 lines | `square.grid.2x2` / `list.bullet` |
| Open original | ↗ arrow | `arrow.up.right` |
| Open externally (iPad header) | box + arrow | `arrow.up.right.square` |
| Share | box + up arrow | `square.and.arrow.up` |
| Copy link | chain | `link` |
| Move to collection | folder | `folder` |
| More | ⋯ / ⋮ | `ellipsis` / `ellipsis.circle` |
| Favorite | filled star | `star.fill` (tint signal) |
| Close / remove | ✕ | `xmark` |
| Back | ← / ‹ | `chevron.left` (system back) |
| Check / selected | ✓ | `checkmark` |
| Trash | bin | `trash` |
| Rename | pencil | `pencil` |
| Import | ↓ | `arrow.down` / `square.and.arrow.down` |
| Article / Video / Product | doc / video / cart | `doc.text` / `play.rectangle` / `cart` |
| Theme | moon / sun | `moon` / `sun.max` |
| Price watch | clock | `clock.arrow.circlepath` |

Icon sizes: 21 (tab bar), 15–16 (header buttons, sheet rows), 13–14 (inline),
11–12 (meta).

---

## 13. Logo and app icon

- **Mark**: three interlocking glossy chain links running bottom-left → top-right:
  **periwinkle/lavender** link, **ink (near-black glass)** link, then a
  **signal-orange** link, with a soft coloured glow. Source:
  `public/images/logo.png` (1254 × 1254, transparent). Web icons:
  `src/app/icon.png` (512) and `src/app/apple-icon.png` (180).
- **In-app tile**: the mark at 78 % inside a transparent rounded square,
  radius 28 % of its side, with a 1.5 pt rim (surface @ .85), inner hairline ink @ .06
  and a soft shadow `0 1 6` ink @ .08. Sizes: 48 (phone drawer), 44 (sidebar),
  36–44 (onboarding).
- **Wordmark**: "AnyLink" in Wordmark (17/600/−0.60), 8 pt from the mark.
- **Token-sheet mark** (older): a 30 pt ink rounded square (r10) with a 14 × 4 signal
  capsule inside. Superseded by the chain.
- **iOS app icon**: rebuild the chain as layers in Icon Composer (background canvas,
  three link layers) so it renders correctly in the iOS 26 Default, Dark, Clear and
  Tinted icon appearances.

---

## 14. Shipped vs mockup: decisions to make

| Topic | Web app (current product) | Mockup (Claude Design, 4d) | Recommendation for iOS |
|---|---|---|---|
| Collection marker | 8 pt **circle** | 7–8 pt **rounded square** (r2–3) | Circle |
| Phone library header | 30 pt "All links" title + sort | Sticky glass header: logo, avatar, search pill, collection chips | Native large title "All links" + `.searchable` + toolbar (layout switch, sort menu). The collection-chip row is optional. |
| Phone list | 2-up tiles ⇄ one-line rows | One lead card + compact rows with thumbnails | Tiles ⇄ rows. The lead card is an optional "latest saved" header. |
| Tab bar | Links · List/Grid (library only) · Collections · Search capsule + separate orange ＋ FAB; hides on scroll | One capsule: ink "Library" pill + search + lime "+" | Native `TabView`: Links · Collections · Search (`Tab(role: .search)`). Put the layout switch in the toolbar, not the tab bar (tabs are places). Add is a signal-tinted glass button (features §2.2). |
| Card actions on phone | Bottom action sheet from ⋯ | — | Context menu on long press + the same sheet from ⋯ |
| Add a link | Themed bottom sheet (canvas, ink text, orbs) | **Light** full screen, 32 pt hero, paste field above the keyboard | System sheet in the app theme, with 4d's content (hero line, clipboard card, share-sheet hint) folded into its idle state |
| Default destination of a new link | "Unsorted" inbox | "Reading" ("lands in Reading by default") | Unsorted |
| Signal colour | `#FF5A1F` | `#FF5A1F` (token-sheet prop default `#F0A000`) | `#FF5A1F` |

---

## 15. SwiftUI token file

```swift
import SwiftUI

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red: CGFloat((hex >> 16) & 0xFF) / 255,
                  green: CGFloat((hex >> 8) & 0xFF) / 255,
                  blue: CGFloat(hex & 0xFF) / 255, alpha: alpha)
    }
}

extension Color {
    init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }
    static func themed(_ light: UInt32, _ dark: UInt32) -> Color {
        Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

/// AnyLink design tokens. Values mirror src/app/globals.css.
enum AL {
    // Theme
    static let canvas    = Color.themed(0xECEEF0, 0x0F1012)
    static let ink       = Color.themed(0x17181B, 0xECEEF0)
    static let paper     = Color.themed(0xFFFFFF, 0x1A1B1F)
    static let surface   = Color.themed(0xFFFFFF, 0x24252A)
    static let rim       = Color.themed(0xFFFFFF, 0x3E4046)
    static let glassTint = Color.themed(0xFFFFFF, 0x1E1F23)
    static let onInk     = Color.themed(0xF4F5F6, 0x17181B)
    static let docShell  = Color.themed(0x0D0E10, 0x1C1D21)
    static let heroPlaceholder = Color.themed(0xDFE2E5, 0x26272B)
    // Accents (theme-independent)
    static let signal      = Color(hex: 0xFF5A1F)
    static let signalSoft  = Color(hex: 0xFF7A45)
    static let lime        = Color(hex: 0xD6F24B)
    static let periwinkle  = Color(hex: 0x7C8CFF)
    static let slate       = Color(hex: 0x9AA3AD)
    static let terracotta  = Color(hex: 0xE0855A)
    static let onAccent    = Color(hex: 0x17181B)
    static let inStock     = Color(hex: 0x00A046)
    static let destructive = Color(hex: 0xEF4444)
    static let destructiveOnDark = Color(hex: 0xFF8A5C)
    static let light       = Color(hex: 0xF4F5F6)   // text on always-dark surfaces (bulk bar)

    enum Ink { static let a60 = 0.60, a50 = 0.50, a45 = 0.45, a20 = 0.20, a06 = 0.06 }

    enum Radius {
        static let kbd: CGFloat = 7, badge: CGFloat = 9, nav: CGFloat = 14
        static let tile: CGFloat = 16, card: CGFloat = 22, panel: CGFloat = 27
        static let article: CGFloat = 28, sheet: CGFloat = 30
    }
    enum Space { static let s1: CGFloat = 8, s2: CGFloat = 14, s3: CGFloat = 18, s4: CGFloat = 26, s5: CGFloat = 48, s6: CGFloat = 70 }
    enum Control { static let sm: CGFloat = 36, md: CGFloat = 44, lg: CGFloat = 52, xl: CGFloat = 58, fab: CGFloat = 56 }

    enum Font {
        static func instrument(_ size: CGFloat, _ weight: SwiftUI.Font.Weight, relativeTo style: SwiftUI.Font.TextStyle) -> SwiftUI.Font {
            .custom("InstrumentSans-Regular", size: size, relativeTo: style).weight(weight)
        }
        static let display  = instrument(56, .semibold, relativeTo: .largeTitle)   // tracking −3.08
        static let hero     = instrument(52, .semibold, relativeTo: .largeTitle)   // tracking −2.86
        static let page     = instrument(30, .semibold, relativeTo: .largeTitle)   // tracking −1.65
        static let title    = instrument(22, .semibold, relativeTo: .title2)       // tracking −0.66
        static let wordmark = instrument(17, .semibold, relativeTo: .headline)     // tracking −0.60
        static let lead     = instrument(14.5, .regular, relativeTo: .callout)     // line height 1.55
        static let body     = instrument(13.5, .medium, relativeTo: .subheadline)
        static let meta     = instrument(11.5, .regular, relativeTo: .caption)
        static let eyebrow  = instrument(10.5, .semibold, relativeTo: .caption2)   // tracking +1.47, uppercase
    }

    static let identityTints: [UInt32] = [0xFF5A1F, 0x7C8CFF, 0xD6F24B, 0x9AA3AD, 0x17181B, 0xE0855A]
    static let identityStripes: [UInt32] = [0xFFFFFF, 0x17181B, 0xD6F24B]
    static let collectionSwatches: [UInt32] = [0xFF5A1F, 0xD6F24B, 0x7C8CFF, 0x9AA3AD, 0xE0855A]

    /// Same output as src/lib/card-identity.ts (checked against it). Prefer the server's values.
    static func identity(for domain: String) -> (tint: UInt32, stripe: UInt32, initial: String) {
        var h: Int32 = 0
        for unit in domain.utf16 { h = h &* 31 &+ Int32(unit) }
        let n = Int(abs(Int64(h)))
        let tint = identityTints[n % identityTints.count]
        var stripe = identityStripes[n % identityStripes.count]
        if stripe == tint { stripe = tint == 0x17181B ? 0xFFFFFF : 0x17181B }
        let initial = domain.first.map { String($0).uppercased() } ?? "?"
        return (tint, stripe, initial)
    }
}
```
