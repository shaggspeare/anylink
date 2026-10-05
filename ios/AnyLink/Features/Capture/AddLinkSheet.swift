import SwiftUI
import PhotosUI
import DesignSystem
import Models
import Networking
import Fixtures
import Store

/// S8. Idle (medium, system glass) → crawling / ready / excerpt-only / failed (large, canvas + sheet orbs).
struct AddLinkSheet: View {
    @Environment(LibraryStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var model: AddLinkModel
    @State private var detent: PresentationDetent
    @State private var typed = ""
    @State private var invalid = false
    @State private var newTag = ""
    @State private var savedCount = 0
    @FocusState private var fieldFocused: Bool
    @State private var composingNote = false
    @State private var photo: PhotosPickerItem?
    @State private var savingImage = false
    private let prefill: URL?

    init(store: LibraryStore, prefill: URL?, collectionID: LinkCollection.ID?) {
        _model = State(initialValue: AddLinkModel(store: store, collectionID: collectionID))
        _detent = State(initialValue: prefill == nil ? .medium : .large)
        self.prefill = prefill
    }

    var body: some View {
        Group {
            if composingNote {
                NoteComposer(collectionID: $model.collectionID, onBack: { withAnimation(AL.Motion.sheet) { composingNote = false } }) {
                    savedCount += 1
                    dismiss()
                }
            } else if model.phase == .idle { idle } else { session }
        }
        .presentationDetents(model.phase == .idle && !composingNote ? [.medium, .large] : [.large], selection: $detent)
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(model.isSaving)
        .sensoryFeedback(.success, trigger: model.step == 3 && model.phase == .ready)
        .sensoryFeedback(.success, trigger: savedCount)
        .onAppear {
            if let prefill { begin(prefill.absoluteString) } else if !store.clipboardHasURL { fieldFocused = true }
        }
        .onDisappear { model.cancel() }
    }

    private func begin(_ raw: String) {
        if model.start(raw) {
            invalid = false
            withAnimation(AL.Motion.sheet) { detent = .large }
        } else {
            invalid = true
        }
    }

    private func save() {
        Task {
            if await model.save() != nil {
                savedCount += 1
                dismiss()
            }
        }
    }

    // MARK: - Idle

    private var idle: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 6) {
                    Circle().fill(AL.signal).frame(width: 6, height: 6)
                    Text("NEW LINK").font(AL.Font.eyebrow).tracking(1.47).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
                Text("Paste anything.\nWe read the rest.")
                    .font(AL.Font.sheetHero).tracking(-1.4)
                    .foregroundStyle(AL.ink)
                    .fixedSize(horizontal: false, vertical: true)
                // Paste only when there's something to paste; otherwise the field is the one way in.
                if store.clipboardHasURL {
                    PasteButton(payloadType: String.self) { strings in
                        if let url = strings.lazy.compactMap(PasteAccessory.firstWebURL).first {
                            Task { @MainActor in begin(url.absoluteString) }
                        }
                    }
                    .buttonBorderShape(.capsule)
                    .controlSize(.large)
                    .tint(AL.signal)
                    .labelStyle(.titleAndIcon)
                    .frame(maxWidth: .infinity)
                    Text("or type a URL").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
                HStack(spacing: 8) {
                    ALField("https://", text: $typed, isURL: true)
                        .focused($fieldFocused)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.go)
                        .onSubmit { begin(typed) }
                    Button { begin(typed) } label: {
                        Image(systemName: "arrow.right")
                            .font(.callout.weight(.semibold))
                            .foregroundStyle(AL.onInk)
                            .frame(width: AL.Control.md, height: AL.Control.md)
                            .background(AL.ink, in: Circle())
                    }
                    .accessibilityLabel("Read link")
                    .disabled(typed.isEmpty)
                }
                if invalid {
                    Text("That doesn't look like a link — it should start with https://")
                        .font(.footnote)
                        .foregroundStyle(AL.destructive)
                }
                otherKinds
                VStack(alignment: .leading, spacing: 4) {
                    Text("Faster from Safari").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                    Text("Share → AnyLink saves the page you're on in one tap.")
                        .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(AL.ink.opacity(AL.Ink.a20), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
                )
            }
            .padding(20)
            .padding(.top, 8)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    // MARK: - Note / image

    /// Not every keeper is a link: a thought, or a screenshot.
    private var otherKinds: some View {
        let imageTitle = savingImage ? "Saving…" : "Image"
        return HStack(spacing: 10) {
            Button {
                withAnimation(AL.Motion.sheet) {
                    composingNote = true
                    detent = .large
                }
            } label: {
                KindTile(title: "Note", subtitle: "Plain text", systemImage: "text.alignleft", accent: AL.lime, mark: AL.noteMark)
            }
            .buttonStyle(TilePressStyle())
            PhotosPicker(selection: $photo, matching: .images, photoLibrary: .shared()) {
                KindTile(title: imageTitle, subtitle: "Screenshot or photo", systemImage: "photo", accent: AL.periwinkle, mark: AL.periwinkle)
            }
            .buttonStyle(TilePressStyle())
            .disabled(savingImage)
        }
        .onChange(of: photo) { _, item in
            guard let item else { return }
            savingImage = true
            Task {
                // The store keeps a local copy before uploading, so the tile shows the moment the sheet closes.
                if let data = try? await item.loadTransferable(type: Data.self),
                   await store.saveImage(data, collectionId: model.collectionID) != nil {
                    savedCount += 1
                    dismiss()
                } else {
                    savingImage = false
                    photo = nil
                }
            }
        }
    }

    // MARK: - Session (crawling / ready / failed)

    private var session: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if model.phase == .failed {
                        Notice("The page wouldn't open (\(model.failure?.reason ?? "unknown")) — the title is guessed from the link. Edit it and save; nothing else is needed.")
                    } else if model.isExcerptOnly {
                        Notice("The site wouldn't give up the full page — this card is built from its metadata and written up by AI. Worth a glance before you save.")
                    }
                    card
                    if model.phase == .crawling { statusLine }
                    collectionPicker
                    if model.phase != .failed { tagsSection }
                    if model.phase != .crawling {
                        ALField("Why you saved this, what to do with it…", text: $model.note)
                    }
                }
                .padding(20)
                .padding(.bottom, 80)
            }
            .background { ZStack { AL.canvas; Orbs(.sheet) }.ignoresSafeArea() }
            .safeAreaInset(edge: .bottom) {
                // The one Save. Mid-crawl it says "Save now": capture never waits for the read.
                Button(model.isDone || model.phase == .failed ? "Save to \(store.name(of: model.collectionID))" : "Save now", action: save)
                    .buttonStyle(.alSignal)
                    .disabled(model.isSaving)
                    .padding(.horizontal, 20)
                    .padding(.bottom, 8)
            }
            .navigationTitle("New link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { model.cancel(); dismiss() }
                }
            }
        }
    }

    // MARK: Card

    private var identity: (tint: Color, stripe: Color, initial: String)? {
        if let r = model.result { return (.fromHex(r.tint), .fromHex(r.stripe), r.initial) }
        if let f = model.failure, let t = f.tint, let s = f.stripe { return (.fromHex(t), .fromHex(s), f.initial ?? "?") }
        guard let d = model.domain else { return nil }
        let i = AL.identity(for: d)
        return (Color(hex: i.tint), Color(hex: i.stripe), i.initial)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack {
                if let identity {
                    if let r = model.result, let hero = r.heroImage.flatMap(URL.init(string:)) {
                        HeroImage(url: hero, tint: identity.tint, stripe: identity.stripe)
                    } else {
                        HeroFallback(tint: identity.tint, stripe: identity.stripe)
                    }
                } else {
                    Shimmer()
                }
            }
            .frame(height: model.phase == .crawling ? 170 : 150)
            .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
            .animation(AL.Motion.sheet, value: model.phase)

            VStack(alignment: .leading, spacing: 8) {
                if let identity, let domain = model.domain {
                    HStack(spacing: 6) {
                        InitialBadge(initial: identity.initial, tint: identity.tint, stripe: identity.stripe, size: 18)
                        Text(domain).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                    }
                }
                if model.phase == .crawling && model.title.isEmpty {
                    SkeletonLine(width: 240); SkeletonLine(width: 180); SkeletonLine(width: 260, height: 10)
                } else {
                    TextField("Title", text: $model.title, axis: .vertical)
                        .lineLimit(1...2)
                        .font(AL.Font.cardTitleL).tracking(-0.72)
                        .foregroundStyle(AL.ink)
                        .padding(.bottom, 4)
                        .overlay(alignment: .bottom) {
                            Line().stroke(AL.ink.opacity(AL.Ink.a20), style: StrokeStyle(lineWidth: 1, dash: [3, 3])).frame(height: 1)
                        }
                        .accessibilityLabel("Title")
                        .accessibilityIdentifier("Title")
                    if !model.excerpt.isEmpty || model.isRefining {
                        HStack(alignment: .firstTextBaseline, spacing: 6) {
                            Text(model.excerpt)
                                .font(AL.Font.lead)
                                .foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                            if model.isRefining {
                                Text("✦ refining")
                                    .font(AL.Font.chip)
                                    .foregroundStyle(AL.periwinkle)
                                    .padding(.horizontal, 8).padding(.vertical, 2)
                                    .background(AL.periwinkleFill, in: Capsule())
                                    .fixedSize()
                            }
                        }
                    }
                    if let meta { Text(meta).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)) }
                }
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 8)
            .animation(AL.Motion.sheet, value: model.step)
        }
        .padding(8)
        .frosted(0.86, radius: 26)
        .alShadow(AL.Shadow.popover)
    }

    private var meta: String? {
        guard let r = model.result else { return nil }
        let kind = r.contentType.rawValue.capitalized
        return r.readingTimeMinutes.map { "\(kind) · \($0) min" } ?? kind
    }

    // MARK: Status line

    private var statusLine: some View {
        HStack(spacing: 10) {
            stage("Found the page", index: 0)
            Text("·").foregroundStyle(AL.ink.opacity(AL.Ink.a30))
            stage("Reading it…", index: 1)
            Text("·").foregroundStyle(AL.ink.opacity(AL.Ink.a30))
            stage("Tags", index: 2)
        }
        .font(.footnote)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private func stage(_ label: String, index: Int) -> some View {
        let done = model.step > index
        let current = model.step == index
        HStack(spacing: 4) {
            if done {
                Image(systemName: "checkmark").font(.caption2.weight(.bold)).foregroundStyle(AL.inStock)
            } else if current {
                PulsingDot()
            }
            Text(label).foregroundStyle(done || current ? AL.ink.opacity(AL.Ink.a80) : AL.ink.opacity(AL.Ink.a40))
        }
    }

    // MARK: Collections

    private var collectionPicker: some View {
        let options = Array(store.collections.filter { $0.isSmart != true }.prefix(5))
        let suggested = model.suggestedCollection?.id
        return VStack(alignment: .leading, spacing: 8) {
            Text(model.phase == .crawling ? "Collection — you can pick while it reads" : "Save to")
                .font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(options) { c in
                        Button { model.collectionID = c.id } label: {
                            ScopeChip(c.id == suggested ? "✦ \(c.name)" : c.name, isSelected: model.collectionID == c.id)
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(model.collectionID == c.id ? .isSelected : [])
                        .accessibilityHint(c.id == suggested ? "Suggested" : "")
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: model.collectionID)
    }

    // MARK: Tags

    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tags").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            if model.phase == .crawling && model.tags.isEmpty {
                HStack(spacing: 8) {
                    ForEach([54, 72, 48], id: \.self) { w in
                        Capsule().fill(AL.ink.opacity(AL.Ink.a06)).frame(width: CGFloat(w), height: 28)
                    }
                }
                .accessibilityHidden(true)
            } else {
                FlowLayout(spacing: 8) {
                    ForEach(model.tags, id: \.self) { t in
                        Button { model.removeTag(t) } label: {
                            HStack(spacing: 4) {
                                Text("#\(t)")
                                Image(systemName: "xmark").font(.caption2.weight(.bold))
                            }
                            .font(AL.Font.chip)
                            .foregroundStyle(AL.onAccent)
                            .padding(.horizontal, 12).frame(height: 30)
                            .background(AL.lime, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove tag \(t)")
                    }
                    ForEach(model.suggestedTags, id: \.self) { t in
                        Button { model.addTag(t) } label: {
                            Text("+ \(t)")
                                .font(AL.Font.chip)
                                .foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                                .padding(.horizontal, 12).frame(height: 30)
                                .overlay(Capsule().strokeBorder(AL.ink.opacity(AL.Ink.a20)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Add tag \(t)")
                    }
                    TextField("+ tag", text: $newTag)
                        .font(AL.Font.chip)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .frame(width: 80, height: 30)
                        .onSubmit { model.addTag(newTag); newTag = "" }
                }
            }
        }
    }
}

// MARK: - Small pieces

/// Half-width entry on the idle sheet: tinted glyph square, title, one-line hint.
private struct KindTile: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let accent: Color
    let mark: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.callout.weight(.bold))
                .foregroundStyle(mark)
                .frame(width: 36, height: 36)
                .background(accent.opacity(0.22), in: RoundedRectangle(cornerRadius: 11, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                Text(subtitle).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a55)).lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(10)
        .frame(maxWidth: .infinity, minHeight: AL.Control.lg)
        .frosted(0.62, radius: AL.Radius.tile)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

private struct Line: Shape {
    func path(in r: CGRect) -> Path { Path { $0.move(to: CGPoint(x: r.minX, y: r.midY)); $0.addLine(to: CGPoint(x: r.maxX, y: r.midY)) } }
}

private struct SkeletonLine: View {
    var width: CGFloat
    var height: CGFloat = 14
    var body: some View {
        RoundedRectangle(cornerRadius: 4).fill(AL.ink.opacity(AL.Ink.a08)).frame(width: width, height: height)
            .accessibilityHidden(true)
    }
}

private struct Shimmer: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var on = false
    var body: some View {
        Rectangle().fill(AL.heroPlaceholder)
            .opacity(on ? 0.55 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.9).repeatForever()) { on = true }
            }
            .accessibilityHidden(true)
    }
}

private struct PulsingDot: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var on = false
    var body: some View {
        Circle().fill(AL.signal).frame(width: 7, height: 7)
            .opacity(on ? 0.3 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 0.7).repeatForever()) { on = true }
            }
    }
}

/// Wraps chips onto new lines.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(width: proposal.width ?? .infinity, subviews)
        return CGSize(width: proposal.width ?? rows.map(\.width).max() ?? 0, height: rows.last.map { $0.y + $0.height } ?? 0)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        for row in arrange(width: bounds.width, subviews) {
            for (i, x) in zip(row.items, row.xs) {
                subviews[i].place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + row.y), proposal: .unspecified)
            }
        }
    }

    private struct Row { var items: [Int] = []; var xs: [CGFloat] = []; var y: CGFloat = 0; var width: CGFloat = 0; var height: CGFloat = 0 }

    private func arrange(width: CGFloat, _ subviews: Subviews) -> [Row] {
        var rows: [Row] = [Row()]
        for (i, v) in subviews.enumerated() {
            let size = v.sizeThatFits(.unspecified)
            if rows[rows.count - 1].width + size.width > width, !rows[rows.count - 1].items.isEmpty {
                let last = rows[rows.count - 1]
                rows.append(Row(y: last.y + last.height + spacing))
            }
            var r = rows[rows.count - 1]
            r.xs.append(r.width)
            r.items.append(i)
            r.width += size.width + spacing
            r.height = max(r.height, size.height)
            rows[rows.count - 1] = r
        }
        return rows
    }
}

// MARK: - Previews


private struct AddPreview: View {
    var prefill: String?
    @State private var env = AppEnvironment.mock(latency: true)
    var body: some View {
        Color.clear.sheet(isPresented: .constant(true)) {
            AddLinkSheet(store: env.store, prefill: prefill.flatMap(URL.init(string:)), collectionID: nil)
                .environment(env.store)
        }
    }
}

#Preview("Idle") { AddPreview() }
#Preview("Idle — Dark") { AddPreview().preferredColorScheme(.dark) }
#Preview("Crawling → ready") { AddPreview(prefill: "https://www.theverge.com/2026/10/a-story") }
#Preview("Excerpt only") { AddPreview(prefill: "https://blocked-news.example/story") }
#Preview("Failed") { AddPreview(prefill: "https://dead-shop.example/apple-macbook-air-m4") }
#Preview("Ready — Dark") { AddPreview(prefill: "https://www.theverge.com/x").preferredColorScheme(.dark) }
