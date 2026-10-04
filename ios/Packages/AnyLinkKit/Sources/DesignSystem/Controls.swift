import SwiftUI
import Models

// MARK: - ScopeChip

public struct ScopeChip: View {
    public let label: String
    public var count: Int?
    public var isSelected: Bool = false

    public init(_ label: String, count: Int? = nil, isSelected: Bool = false) {
        self.label = label; self.count = count; self.isSelected = isSelected
    }

    public var body: some View {
        HStack(spacing: 4) {
            Text(label)
            if let count {
                Text("\(count)")
                    .foregroundStyle(isSelected ? AL.onInk.opacity(0.7) : AL.ink.opacity(AL.Ink.a55))
            }
        }
        .font(AL.Font.chip)
        .foregroundStyle(isSelected ? AL.onInk : AL.ink.opacity(AL.Ink.a75))
        .padding(.horizontal, 14)
        .frame(height: 34)
        .background(isSelected ? AnyShapeStyle(AL.ink) : AnyShapeStyle(AL.ink.opacity(AL.Ink.a06)), in: Capsule())
        .sensoryFeedback(.selection, trigger: isSelected)
    }
}

// MARK: - KeepBinSegment

public struct KeepBinSegment: View {
    @Binding public var isKeep: Bool

    public init(isKeep: Binding<Bool>) {
        self._isKeep = isKeep
    }

    public var body: some View {
        HStack(spacing: 0) {
            segment("Keep", selected: isKeep) { isKeep = true }
            segment("Bin", selected: !isKeep) { isKeep = false }
        }
        .padding(3)
        .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
        .sensoryFeedback(.selection, trigger: isKeep)
    }

    private func segment(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(AL.Font.brand(13, .semibold, relativeTo: .footnote))
                .foregroundStyle(selected && title == "Keep" ? AL.onAccent : (selected ? AL.onInk : AL.ink))
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(
                    selected ? AnyShapeStyle(title == "Keep" ? AL.lime : AL.ink) : AnyShapeStyle(Color.clear),
                    in: Capsule()
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - UnsortedBanner

public struct UnsortedBanner: View {
    public let count: Int
    public let onSort: () -> Void

    public init(count: Int, onSort: @escaping () -> Void) {
        self.count = count; self.onSort = onSort
    }

    public var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Circle().fill(AL.slate).frame(width: 10, height: 10)
                    Text("\(count.linkCount) in Unsorted")
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(AL.ink)
                }
                Text("Sort them in about a minute")
                    .font(AL.Font.meta)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .padding(.leading, 16)
            }
            Spacer(minLength: 0)
            Button(action: onSort) {
                Text("Sort")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(AL.ink)
                    .padding(.horizontal, 16)
                    .frame(minHeight: AL.Control.md)
                    .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("unsorted-sort")
        }
        .padding(.init(top: 8, leading: 14, bottom: 8, trailing: 8))
        .frosted(0.62, radius: 18)
    }
}

// MARK: - PasteAccessory

/// Content of `.tabViewBottomAccessory`. The clipboard is only read through `PasteButton`, so no paste alert.
// Inside system glass, hierarchical styles (.primary/.secondary) stay legible as the glass adapts to what's
// beneath it; AL.ink would follow the adapted scheme and wash out.
public struct PasteAccessory: View {
    public var hasURL: Bool
    public var collectionName: String?
    public var compact: Bool
    public var onPaste: ([URL]) -> Void
    public var onNew: () -> Void

    public init(hasURL: Bool = false, collectionName: String? = nil, compact: Bool = false,
                onPaste: @escaping ([URL]) -> Void = { _ in }, onNew: @escaping () -> Void = {}) {
        self.hasURL = hasURL; self.collectionName = collectionName; self.compact = compact
        self.onPaste = onPaste; self.onNew = onNew
    }

    private var title: String {
        if let collectionName { return "Paste into \(collectionName)" }
        return hasURL ? "Link on your clipboard" : "Paste a link"
    }
    private var subtitle: String? {
        if collectionName != nil { return "Saves straight to this collection" }
        return hasURL ? "Paste to save it" : nil
    }

    public nonisolated static func firstWebURL(in text: String) -> URL? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..., in: text)
        return detector?.matches(in: text, range: range).lazy
            .compactMap(\.url)
            .first { $0.scheme == "http" || $0.scheme == "https" }
    }

    public var body: some View {
        if hasURL {
            row
        } else {
            // With nothing to paste, the whole bar opens the sheet; "New" is just its visible label.
            Button(action: onNew) { row.contentShape(Rectangle()) }
                .buttonStyle(.plain)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("New link")
                .accessibilityAddTraits(.isButton)
        }
    }

    private var row: some View {
        HStack(spacing: 10) {
            Image(systemName: "link")
                .font(.callout.weight(.semibold))
                .foregroundStyle(hasURL ? AnyShapeStyle(AL.signal) : AnyShapeStyle(.secondary))
                .accessibilityHidden(true)
            if !compact {
                VStack(alignment: .leading, spacing: 1) {
                    Text(title)
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(.primary)
                    if let subtitle {
                        Text(subtitle)
                            .font(AL.Font.meta)
                            .foregroundStyle(.secondary)
                    }
                }
                .lineLimit(1)
                Spacer(minLength: 0)
            }
            if hasURL {
                // String covers both URL-typed items (Safari "Copy Link") and plain text holding a link.
                PasteButton(payloadType: String.self) { strings in onPaste(strings.compactMap(Self.firstWebURL)) }
                    .buttonBorderShape(.capsule)
                    .tint(AL.lime)
                    .labelStyle(.titleAndIcon)
                    .foregroundStyle(AL.onAccent)
            } else {
                Text("New")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 38)
                    .background(AL.ink.opacity(AL.Ink.a08), in: Capsule())
            }
        }
        .padding(.horizontal, 16)
    }
}

// MARK: - Field

public struct ALField: View {
    public let placeholder: String
    @Binding public var text: String
    public var isURL: Bool = false

    public init(_ placeholder: String, text: Binding<String>, isURL: Bool = false) {
        self.placeholder = placeholder; self._text = text; self.isURL = isURL
    }

    public var body: some View {
        TextField(placeholder, text: $text)
            .font(.callout)
            .padding(.horizontal, 14)
            .frame(height: 44)
            .background(AL.ink.opacity(AL.Ink.a06), in: isURL ? AnyShape(Capsule()) : AnyShape(RoundedRectangle(cornerRadius: 14, style: .continuous)))
    }
}

// MARK: - Notice

public struct Notice: View {
    public let text: String

    public init(_ text: String) { self.text = text }

    public var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.init(top: 10, leading: 14, bottom: 10, trailing: 14))
            .background(AL.noticeFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Button styles

public struct ALPrimaryButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View { Styled(configuration: configuration) }

    private struct Styled: View {
        let configuration: Configuration
        @Environment(\.isEnabled) private var isEnabled
        var body: some View { styled.opacity(isEnabled ? 1 : 0.35) }
        @ViewBuilder private var styled: some View {
        configuration.label
            .font(AL.Font.brand(15, .semibold, relativeTo: .body))
            .foregroundStyle(AL.onInk)
            .frame(maxWidth: .infinity)
            .frame(minHeight: AL.Control.lg)
            .background(AL.ink, in: Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1)
        }
    }
}

public struct ALSignalButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View { Styled(configuration: configuration) }

    private struct Styled: View {
        let configuration: Configuration
        @Environment(\.isEnabled) private var isEnabled
        var body: some View { styled.opacity(isEnabled ? 1 : 0.35) }
        @ViewBuilder private var styled: some View {
        configuration.label
            .font(AL.Font.brand(15, .semibold, relativeTo: .body))
            .foregroundStyle(AL.onAccent)
            .frame(maxWidth: .infinity)
            .frame(minHeight: AL.Control.lg)
            .background(AL.signal, in: Capsule())
            .shadow(color: AL.signal.opacity(isEnabled ? 0.7 : 0), radius: 15, y: 10)
            .opacity(configuration.isPressed ? 0.8 : 1)
        }
    }
}

public struct ALSmallButtonStyle: ButtonStyle {
    public enum Variant { case lime, ink, soft }
    let variant: Variant

    public init(_ variant: Variant = .ink) { self.variant = variant }

    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AL.Font.brand(13, .semibold, relativeTo: .footnote))
            .foregroundStyle(foreground)
            .frame(minHeight: AL.Control.sm)
            .padding(.horizontal, 14)
            .background(background, in: Capsule())
            .opacity(configuration.isPressed ? 0.7 : 1)
    }

    private var foreground: Color {
        switch variant {
        case .lime: AL.onAccent
        case .ink: AL.onInk
        case .soft: AL.ink
        }
    }

    private var background: Color {
        switch variant {
        case .lime: AL.lime
        case .ink: AL.ink
        case .soft: AL.ink.opacity(AL.Ink.a06)
        }
    }
}

extension ButtonStyle where Self == ALPrimaryButtonStyle {
    public static var alPrimary: ALPrimaryButtonStyle { .init() }
}
extension ButtonStyle where Self == ALSignalButtonStyle {
    public static var alSignal: ALSignalButtonStyle { .init() }
}

// MARK: - Previews

#Preview("ScopeChip") {
    ScrollView(.horizontal) {
        HStack(spacing: 8) {
            ScopeChip("All", count: 18, isSelected: true)
            ScopeChip("Reading", count: 4)
            ScopeChip("iOS", count: 6)
            ScopeChip("Cooking", count: 2)
        }
        .padding(.horizontal, 16)
    }
}

#Preview("KeepBinSegment") {
    KeepBinSegment(isKeep: .constant(true))
        .frame(width: 200)
        .padding()
}

#Preview("UnsortedBanner") {
    VStack {
        UnsortedBanner(count: 12) {}
    }
    .padding()
    .background(AL.canvas)
}

#Preview("PasteAccessory") {
    VStack(spacing: 20) {
        PasteAccessory(hasURL: true)
        PasteAccessory()
        PasteAccessory(hasURL: true, collectionName: "Reading")
        PasteAccessory(hasURL: true, compact: true)
    }
    .padding()
}

#Preview("Buttons") {
    VStack(spacing: 12) {
        Button("Sign in with Apple") {}.buttonStyle(.alPrimary)
        Button("Save link") {}.buttonStyle(.alSignal)
        HStack(spacing: 8) {
            Button("Keep") {}.buttonStyle(ALSmallButtonStyle(.lime))
            Button("Rename") {}.buttonStyle(ALSmallButtonStyle(.soft))
            Button("Delete") {}.buttonStyle(ALSmallButtonStyle(.ink))
        }
    }
    .padding()
}

#Preview("Field + Notice") {
    VStack(spacing: 12) {
        ALField("Enter a URL", text: .constant(""), isURL: true)
        ALField("Add a note", text: .constant(""))
        Notice("This link couldn't be fully read. You'll see the title and excerpt only.")
    }
    .padding()
}

#Preview("Controls — Dark, Large Type") {
    VStack(spacing: 12) {
        UnsortedBanner(count: 12) {}
        PasteAccessory(hasURL: true)
        Notice("Excerpt only.")
        ScopeChip("All", count: 18, isSelected: true)
    }
    .padding()
    .background(AL.canvas)
    .preferredColorScheme(.dark)
    .dynamicTypeSize(.accessibility2)
}
