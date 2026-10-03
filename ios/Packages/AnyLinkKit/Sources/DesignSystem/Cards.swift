import SwiftUI
import Models

// MARK: - CollectionCard

public struct CollectionCard: View {
    public let collection: LinkCollection
    public let linkCount: Int
    public let topLinks: [LinkItem]

    public init(collection: LinkCollection, linkCount: Int, topLinks: [LinkItem] = []) {
        self.collection = collection; self.linkCount = linkCount; self.topLinks = topLinks
    }

    private var dotColor: Color { .fromHex(collection.color) }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            mosaic.padding(6)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Circle().fill(dotColor).frame(width: 8, height: 8)
                    Text(collection.name)
                        .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                        .foregroundStyle(AL.ink)
                        .lineLimit(1)
                }
                Text("\(linkCount) links")
                    .font(AL.Font.meta)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    .padding(.leading, 14)
            }
            .padding(.horizontal, 10)
            .padding(.bottom, 10)
        }
        .frame(height: 150)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frosted(0.62, radius: 20)
    }

    private var mosaic: some View {
        HStack(spacing: 2) {
            if let first = topLinks.first {
                HeroFallback(
                    tint: .fromHex(first.tint),
                    stripe: .fromHex(first.stripe)
                )
            } else {
                Rectangle().fill(dotColor.opacity(0.3))
            }
            VStack(spacing: 2) {
                Rectangle().fill(topLinks.count > 1 ? Color.fromHex(topLinks[1].tint) : dotColor.opacity(0.2))
                Rectangle().fill(topLinks.count > 2 ? Color.fromHex(topLinks[2].tint) : dotColor.opacity(0.15))
            }
        }
        .frame(height: 80)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - NewCollectionCard

public struct NewCollectionCard: View {
    public let action: () -> Void

    public init(action: @escaping () -> Void) { self.action = action }

    public var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: "plus")
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a40))
                Text("New collection")
                    .font(AL.Font.brand(14, .semibold, relativeTo: .subheadline))
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(AL.ink.opacity(AL.Ink.a20), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            )
        }
        .buttonStyle(.plain)
        .frame(height: 150)
    }
}

// MARK: - WhyCard

public struct WhyCard: View {
    public let reasoning: String
    public var onKeep: () -> Void = {}
    public var onRename: () -> Void = {}
    public var onDissolve: () -> Void = {}

    public init(reasoning: String, onKeep: @escaping () -> Void = {}, onRename: @escaping () -> Void = {}, onDissolve: @escaping () -> Void = {}) {
        self.reasoning = reasoning; self.onKeep = onKeep; self.onRename = onRename; self.onDissolve = onDissolve
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(AL.periwinkle)
                Text("WHY THIS EXISTS")
                    .font(AL.Font.eyebrow)
                    .tracking(1.47)
                    .textCase(.uppercase)
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            }
            Text(reasoning)
                .font(AL.Font.body)
                .foregroundStyle(AL.ink)
            HStack(spacing: 8) {
                Button(action: onKeep) {
                    Label("Keep", systemImage: "checkmark")
                }
                .buttonStyle(ALSmallButtonStyle(.lime))
                Button("Rename", action: onRename)
                    .buttonStyle(ALSmallButtonStyle(.soft))
                Button("Dissolve", action: onDissolve)
                    .font(AL.Font.brand(13, .semibold, relativeTo: .footnote))
                    .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    .frame(height: AL.Control.sm)
                    .padding(.horizontal, 14)
                    .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
            }
        }
        .padding(14)
        .frosted(0.62, radius: 20)
    }
}

// MARK: - SwipeCardStack

public enum SwipeDirection: Sendable { case left, right }

/// Top two items render; the front one drags. Buttons below duplicate the gesture for accessibility.
public struct SwipeCardStack<Item: Identifiable, Card: View>: View {
    let items: [Item]
    let rightStamp: (Item) -> String
    let leftStamp: String
    let onCommit: (Item, SwipeDirection) -> Void
    let card: (Item) -> Card

    @State private var offset: CGSize = .zero
    @State private var committing = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    public init(
        items: [Item],
        rightStamp: @escaping (Item) -> String = { _ in "Keep" },
        leftStamp: String = "Bin",
        onCommit: @escaping (Item, SwipeDirection) -> Void,
        @ViewBuilder card: @escaping (Item) -> Card
    ) {
        self.items = items; self.rightStamp = rightStamp; self.leftStamp = leftStamp
        self.onCommit = onCommit; self.card = card
    }

    public var body: some View {
        VStack(spacing: 20) {
            ZStack {
                if items.count > 1 {
                    styled(card(items[1]))
                        .scaleEffect(0.95)
                        .rotationEffect(.degrees(-4))
                        .allowsHitTesting(false)
                        .accessibilityHidden(true)
                }
                if let front = items.first {
                    styled(card(front))
                        .overlay { stamp(for: front) }
                        .offset(offset)
                        .rotationEffect(.degrees(Double(offset.width) / 25))
                        .gesture(drag(front))
                        .id(front.id)
                        .accessibilityElement(children: .combine)
                        .accessibilityAction(named: Text(rightStamp(front))) { commit(front, .right) }
                        .accessibilityAction(named: Text(leftStamp)) { commit(front, .left) }
                }
            }
            if let front = items.first {
                HStack(spacing: 12) {
                    Button(leftStamp) { commit(front, .left) }
                        .buttonStyle(.alPrimary)
                    Button(rightStamp(front)) { commit(front, .right) }
                        .buttonStyle(ALLimeButtonStyle())
                }
                .disabled(committing)
            }
        }
        .sensoryFeedback(.success, trigger: items.first?.id)
    }

    private func styled(_ v: Card) -> some View {
        v.frosted(0.86, radius: 26).alShadow(AL.Shadow.window)
    }

    @ViewBuilder
    private func stamp(for item: Item) -> some View {
        let dx = offset.width
        if abs(dx) > 4 {
            Text(dx > 0 ? rightStamp(item) : leftStamp)
                .font(AL.Font.brand(22, .bold, relativeTo: .title2))
                .textCase(.uppercase)
                .foregroundStyle(dx > 0 ? AL.onAccent : AL.onInk)
                .padding(.horizontal, 14).padding(.vertical, 6)
                .background(dx > 0 ? AL.lime : AL.ink, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .rotationEffect(.degrees(dx > 0 ? -8 : 8))
                .opacity(min(abs(dx) / 100, 1))
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: dx > 0 ? .topLeading : .topTrailing)
                .padding(24)
                .allowsHitTesting(false)
        }
    }

    private func drag(_ item: Item) -> some Gesture {
        DragGesture()
            .onChanged { if !committing { offset = $0.translation } }
            .onEnded { v in
                let dx = v.translation.width
                if abs(dx) > 100 || abs(v.predictedEndTranslation.width) > 400 {
                    commit(item, dx > 0 ? .right : .left)
                } else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.75)) { offset = .zero }
                }
            }
    }

    private func commit(_ item: Item, _ dir: SwipeDirection) {
        guard !committing else { return }
        committing = true
        let target = CGSize(width: dir == .right ? 600 : -600, height: offset.height)
        let duration = reduceMotion ? 0 : 0.32
        withAnimation(.linear(duration: duration)) { offset = target } completion: {
            onCommit(item, dir)
            offset = .zero
            committing = false
        }
    }
}

public struct ALLimeButtonStyle: ButtonStyle {
    public init() {}
    public func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(AL.Font.brand(15, .semibold, relativeTo: .body))
            .foregroundStyle(AL.onAccent)
            .frame(maxWidth: .infinity)
            .frame(height: AL.Control.lg)
            .background(AL.lime, in: Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

// MARK: - Previews

private let sampleCollection = LinkCollection(id: "reading", name: "Reading", color: "#7C8CFF")

#Preview("CollectionCard") {
    LazyVGrid(columns: [.init(), .init()], spacing: 12) {
        CollectionCard(collection: sampleCollection, linkCount: 7)
        CollectionCard(
            collection: LinkCollection(id: "ios", name: "iOS", color: "#FF5A1F"),
            linkCount: 3
        )
        NewCollectionCard {}
    }
    .padding()
    .background(AL.canvas)
}

#Preview("WhyCard") {
    WhyCard(reasoning: "These 5 links are all about Rust async patterns. They share the #rust tag and were saved in the same week.")
        .padding()
        .background(AL.canvas)
}

#Preview("WhyCard — Dark") {
    WhyCard(reasoning: "These links cover iOS development topics including SwiftUI and concurrency.")
        .padding()
        .background(AL.canvas)
        .preferredColorScheme(.dark)
}

private struct PreviewCard: Identifiable { let id: Int; let title: String }

#Preview("SwipeCardStack") {
    @Previewable @State var items = (1...4).map { PreviewCard(id: $0, title: "Card \($0)") }
    SwipeCardStack(items: items, rightStamp: { _ in "Keep" }, onCommit: { _, _ in items.removeFirst() }) { item in
        VStack(alignment: .leading, spacing: 12) {
            HeroFallback(tint: AL.signal, stripe: .white)
                .frame(height: 176)
                .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
            Text(item.title).font(AL.Font.cardTitleL).foregroundStyle(AL.ink)
        }
        .padding(8)
        .padding(.bottom, 12)
    }
    .padding(30)
    .background(AL.canvas)
}

#Preview("Reduce Transparency") {
    VStack(spacing: 12) {
        WhyCard(reasoning: "Frosted surfaces turn solid paper.")
        CollectionCard(collection: sampleCollection, linkCount: 7)
    }
    .padding()
    .background(AL.canvas)
    .environment(\.alForceSolid, true)
}

#Preview("Large Dynamic Type") {
    WhyCard(reasoning: "These links share the #rust tag.")
        .padding()
        .background(AL.canvas)
        .dynamicTypeSize(.accessibility3)
}
