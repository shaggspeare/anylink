#if DEBUG
import SwiftUI
import DesignSystem
import Models
import Store

struct GalleryView: View {
    @State private var keepBin = true
    @State private var fieldText = ""
    @State private var dark = false
    @State private var solid = false
    @State private var largeType = false
    @State private var swipeItems = (1...5).map { SwipeItem(id: $0) }
    @State private var toasts = ToastCenter()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    heroFallbackSection
                    initialBadgeSection
                    tileSection
                    rowSection
                    scopeChipSection
                    keepBinSection
                    unsortedBannerSection
                    pasteAccessorySection
                    collectionCardSection
                    whyCardSection
                    buttonSection
                    fieldSection
                    noticeSection
                    toastSection
                    swipeSection
                }
                .padding()
            }
            .background(AL.canvas)
            .navigationTitle("Gallery")
            .toolbar {
                Menu("Env", systemImage: "slider.horizontal.3") {
                    Toggle("Dark", isOn: $dark)
                    Toggle("Reduce Transparency", isOn: $solid)
                    Toggle("Large Type", isOn: $largeType)
                }
            }
        }
        .preferredColorScheme(dark ? .dark : .light)
        .environment(\.alForceSolid, solid)
        .dynamicTypeSize(largeType ? .accessibility2 : .large)
        .toastOverlay(toasts, bottomOffset: 40)
    }

    struct SwipeItem: Identifiable { let id: Int }

    private var swipeSection: some View {
        section("SwipeCardStack") {
            if swipeItems.isEmpty {
                Button("Reset") { swipeItems = (1...5).map { SwipeItem(id: $0) } }
                    .buttonStyle(ALSmallButtonStyle(.soft))
            } else {
                SwipeCardStack(items: swipeItems, rightStamp: { _ in "Reading" }, leftStamp: "Trash") { item, dir in
                    swipeItems.removeFirst()
                    toasts.show(dir == .right ? "Moved to Reading" : "Moved to Trash", undo: {})
                } card: { item in
                    VStack(alignment: .leading, spacing: 10) {
                        HeroFallback(tint: item.id.isMultiple(of: 2) ? AL.periwinkle : AL.signal, stripe: .white)
                            .frame(height: 176)
                            .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
                        Text("Card \(item.id)").font(AL.Font.cardTitleL).foregroundStyle(AL.ink)
                    }
                    .padding(8)
                    .padding(.bottom, 12)
                }
                .padding(.horizontal, 14)
            }
        }
    }

    // MARK: - Sections

    private var heroFallbackSection: some View {
        section("HeroFallback + HeroImage") {
            HStack(spacing: 12) {
                HeroFallback(tint: AL.signal, stripe: .white)
                    .frame(width: 120, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                HeroFallback(tint: AL.periwinkle, stripe: Color(hex: 0x17181B), band: 4, gap: 8)
                    .frame(width: 120, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                HeroImage(url: nil, tint: AL.slate, stripe: .white)
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
    }

    private var initialBadgeSection: some View {
        section("InitialBadge") {
            HStack(spacing: 12) {
                InitialBadge(initial: "N", tint: AL.signal, stripe: .white, size: 14)
                InitialBadge(initial: "A", tint: AL.periwinkle, stripe: .white, size: 18)
                InitialBadge(initial: "R", tint: Color(hex: 0x17181B), stripe: AL.lime, size: 24)
                InitialBadge(initial: "K", tint: AL.slate, stripe: .white, size: 32)
            }
        }
    }

    private var tileSection: some View {
        section("LinkTile") {
            HStack(spacing: 8) {
                LinkTile(link: Self.sampleArticle)
                LinkTile(link: Self.sampleVideo)
            }
            HStack(spacing: 8) {
                LinkTile(link: Self.sampleArticle, isSelected: true, selectMode: true)
                LinkTile(link: Self.sampleVideo, isSelected: false, selectMode: true)
            }
        }
    }

    private var rowSection: some View {
        section("LinkRow") {
            VStack(spacing: 0) {
                LinkRow(link: Self.sampleArticle)
                Divider()
                LinkRow(link: Self.sampleVideo)
                Divider()
                LinkRow(link: Self.sampleArticle, isSelected: true, selectMode: true)
            }
            .padding(.horizontal, 12)
            .frosted(0.62, radius: 16)
        }
    }

    private var scopeChipSection: some View {
        section("ScopeChip") {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ScopeChip("All", count: 18, isSelected: true)
                    ScopeChip("Reading", count: 4)
                    ScopeChip("iOS", count: 6)
                    ScopeChip("Cooking", count: 2)
                }
            }
        }
    }

    private var keepBinSection: some View {
        section("KeepBinSegment") {
            KeepBinSegment(isKeep: $keepBin)
                .frame(width: 200)
        }
    }

    private var unsortedBannerSection: some View {
        section("UnsortedBanner") {
            UnsortedBanner(count: 12) {}
        }
    }

    private var pasteAccessorySection: some View {
        section("PasteAccessory") {
            VStack(spacing: 12) {
                PasteAccessory(hasURL: true)
                    .frosted(0.62, radius: 16)
                PasteAccessory()
                    .frosted(0.62, radius: 16)
            }
        }
    }

    private var collectionCardSection: some View {
        section("CollectionCard") {
            LazyVGrid(columns: [.init(), .init()], spacing: 12) {
                CollectionCard(
                    collection: LinkCollection(id: "r", name: "Reading", color: "#7C8CFF"),
                    linkCount: 7
                )
                CollectionCard(
                    collection: LinkCollection(id: "i", name: "iOS", color: "#FF5A1F"),
                    linkCount: 3
                )
                NewCollectionCard {}
            }
        }
    }

    private var whyCardSection: some View {
        section("WhyCard") {
            WhyCard(reasoning: "These 5 links are all about Rust async patterns. They share the #rust tag and were saved in the same week.")
        }
    }

    private var buttonSection: some View {
        section("Buttons") {
            VStack(spacing: 12) {
                Button("Primary action") {}.buttonStyle(.alPrimary)
                Button("Save link") {}.buttonStyle(.alSignal)
                HStack(spacing: 8) {
                    Button("Keep") {}.buttonStyle(ALSmallButtonStyle(.lime))
                    Button("Rename") {}.buttonStyle(ALSmallButtonStyle(.soft))
                    Button("Archive") {}.buttonStyle(ALSmallButtonStyle(.ink))
                }
            }
        }
    }

    private var fieldSection: some View {
        section("Field") {
            VStack(spacing: 8) {
                ALField("https://example.com", text: $fieldText, isURL: true)
                ALField("Add a note…", text: $fieldText)
            }
        }
    }

    private var noticeSection: some View {
        section("Notice") {
            Notice("This link couldn't be fully read. You'll see the title and excerpt only.")
        }
    }

    private var toastSection: some View {
        section("Toast") {
            VStack(spacing: 12) {
                ToastView("Moved to Reading")
                ToastView("3 links moved to Trash") {}
                Button("Show live toast") { toasts.show("Saved to Unsorted", undo: {}) }
                    .buttonStyle(ALSmallButtonStyle(.soft))
            }
        }
    }

    // MARK: - Helper

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AL.Font.eyebrow)
                .tracking(1.47)
                .textCase(.uppercase)
                .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
            content()
        }
    }

    // MARK: - Sample data

    private static let sampleArticle = LinkItem(
        id: "ga", url: "https://nasa.gov/missions/artemis", domain: "nasa.gov",
        title: "NASA's next-gen space suit costs $3.5 billion", excerpt: "Overview of costs.",
        tint: "#FF5A1F", stripe: "#FFFFFF", initial: "N",
        contentType: .article, readingTimeMinutes: 6,
        collectionId: "unsorted", tags: ["space"], size: .M,
        status: .ready, createdAt: "2026-10-01T00:00:00Z", favorite: true
    )

    private static let sampleVideo = LinkItem(
        id: "gv", url: "https://youtube.com/watch?v=1", domain: "youtube.com",
        title: "Rust for beginners — full course", excerpt: "",
        tint: "#7C8CFF", stripe: "#FFFFFF", initial: "Y",
        contentType: .video,
        collectionId: "unsorted", tags: ["rust"], size: .M,
        status: .ready, createdAt: "2026-10-01T00:00:00Z"
    )
}

#Preview("Gallery — Light") { GalleryView() }
#Preview("Gallery — Dark") { GalleryView().preferredColorScheme(.dark) }
#endif
