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
                    Text("\(count) links in Unsorted")
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(AL.ink)
                }
                Text("Sort them in about a minute")
                    .font(AL.Font.meta)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .padding(.leading, 16)
            }
            Spacer(minLength: 0)
            Button("Sort", action: onSort)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(AL.ink)
                .frame(height: 40)
                .padding(.horizontal, 16)
                .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
        }
        .padding(.init(top: 8, leading: 14, bottom: 8, trailing: 8))
        .frosted(0.62, radius: 18)
    }
}

// MARK: - PasteAccessory

public struct PasteAccessory: View {
    public var detectedURL: URL?
    public var collectionName: String?
    public var onNew: () -> Void = {}

    public init(detectedURL: URL? = nil, collectionName: String? = nil, onNew: @escaping () -> Void = {}) {
        self.detectedURL = detectedURL; self.collectionName = collectionName; self.onNew = onNew
    }

    private var hasURL: Bool { detectedURL != nil }

    public var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "link")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(hasURL ? AL.signal : AL.ink.opacity(AL.Ink.a45))
            VStack(alignment: .leading, spacing: 1) {
                if hasURL {
                    Text(collectionName != nil ? "Paste into \(collectionName!)" : "Link on your clipboard")
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(AL.ink)
                    Text(collectionName != nil ? "Saves straight to this collection" : "Paste to save it")
                        .font(AL.Font.meta)
                        .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                } else {
                    Text("Paste a link")
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(AL.ink)
                }
            }
            Spacer(minLength: 0)
            if hasURL {
                // PasteButton placeholder — actual PasteButton wired in Phase 3
                Text("Paste")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AL.onAccent)
                    .padding(.horizontal, 16)
                    .frame(height: 38)
                    .background(AL.lime, in: Capsule())
            } else {
                Button(action: onNew) {
                    Text("New")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(AL.ink)
                        .padding(.horizontal, 16)
                        .frame(height: 38)
                        .background(AL.ink.opacity(AL.Ink.a08), in: Capsule())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
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
            .font(.system(size: 16))
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
            .font(.system(size: 13))
            .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.init(top: 10, leading: 14, bottom: 10, trailing: 14))
            .background(AL.noticeFill, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Button styles

public struct ALPrimaryButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AL.Font.brand(15, .semibold, relativeTo: .body))
            .foregroundStyle(AL.onInk)
            .frame(maxWidth: .infinity)
            .frame(height: AL.Control.lg)
            .background(AL.ink, in: Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

public struct ALSignalButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AL.Font.brand(15, .semibold, relativeTo: .body))
            .foregroundStyle(AL.onAccent)
            .frame(maxWidth: .infinity)
            .frame(height: AL.Control.lg)
            .background(AL.signal, in: Capsule())
            .shadow(color: AL.signal.opacity(0.7), radius: 15, y: 10)
            .opacity(configuration.isPressed ? 0.8 : 1)
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
            .frame(height: AL.Control.sm)
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
        PasteAccessory(detectedURL: URL(string: "https://example.com"))
        PasteAccessory()
        PasteAccessory(detectedURL: URL(string: "https://x.com"), collectionName: "Reading")
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
        PasteAccessory(detectedURL: URL(string: "https://example.com"))
        Notice("Excerpt only.")
        ScopeChip("All", count: 18, isSelected: true)
    }
    .padding()
    .background(AL.canvas)
    .preferredColorScheme(.dark)
    .dynamicTypeSize(.accessibility2)
}
