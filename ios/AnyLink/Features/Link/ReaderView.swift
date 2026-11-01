import SwiftUI
import DesignSystem
import Models
import QueryLanguage
import Networking
import Fixtures
import Store

/// S15: the generic layout (free), and Pro's article, video and recipe templates inside it.
struct ReaderView: View {
    let link: LinkItem
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var editingNote = false
    @State private var noteDraft = ""
    @State private var playing = false
    @FocusState private var noteFocused: Bool

    private var url: URL? { URL(string: link.url) }
    /// What the templates read. Free accounts get none of it.
    private var template: TemplateData? { store.isPro ? link.templateData : nil }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                VStack(alignment: .leading, spacing: 20) {
                    chips
                    if link.hasNote || editingNote { noteCard }
                    content
                    alsoIn
                }
                .padding(.horizontal, 20)
                .padding(.top, 24)
                .padding(.bottom, 40)
            }
        }
        .ignoresSafeArea(edges: .top)
        .background { ZStack { AL.canvas; Orbs(.reader) }.ignoresSafeArea() }
        .toolbarBackgroundVisibility(.hidden, for: .navigationBar)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .onChange(of: noteFocused) { _, focused in if !focused { commitNote() } }
    }

    // MARK: Hero

    /// Stretchy image under the scrim; at least 400 pt, taller when large type needs the room.
    private var hero: some View {
        ZStack(alignment: .bottomLeading) {
            GeometryReader { g in
                let pull = max(0, g.frame(in: .scrollView).minY)
                HeroImage(link: link)
                    .frame(width: g.size.width, height: g.size.height + pull)
                    .clipped()
                    .overlay(ReaderScrim())
                    .offset(y: -pull)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(eyebrow.uppercased())
                    .font(.caption2.weight(.semibold)).tracking(1.47)
                    .foregroundStyle(.white)
                Text(link.title)
                    .font(AL.Font.readerTitle).tracking(-1.2)
                    .foregroundStyle(.white)
                    .accessibilityAddTraits(.isHeader)
            }
            .fixedSize(horizontal: false, vertical: true)
            .shadow(color: .black.opacity(0.5), radius: 1.5, y: 1)
            .padding(20)
            .padding(.top, 240)
        }
        .frame(minHeight: 400)
    }

    private var eyebrow: String {
        let kind: String? = switch link.contentType {
        case .video: "Video"
        case .recipe: "Recipe"
        default: link.readingTimeMinutes.map { "\($0) min read" }
        }
        return [link.domain, kind].compactMap { $0 }.joined(separator: " · ")
    }

    // MARK: Chips

    private var chips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Button { router.sheet = .moveLinks([link.id]) } label: {
                    HStack(spacing: 6) {
                        Circle().fill(store.collection(link.collectionId).map { Color.fromHex($0.color) } ?? AL.slate).frame(width: 8, height: 8)
                        Text(store.name(of: link.collectionId))
                        Image(systemName: "chevron.down").font(.caption2.weight(.semibold))
                    }
                    .font(AL.Font.chip).foregroundStyle(AL.ink)
                    .padding(.horizontal, 12).frame(height: 32)
                    .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
                }
                .accessibilityLabel("Collection, \(store.name(of: link.collectionId))")
                .accessibilityHint("Moves the link")
                if link.isBroken {
                    Text("Gone")
                        .font(AL.Font.chip).foregroundStyle(.white)
                        .padding(.horizontal, 12).frame(height: 32)
                        .background(AL.slate, in: Capsule())
                }
                ForEach(link.tags, id: \.self) { t in
                    Button { router.open(.filter(Query("#\(t)"), title: "#\(t)")) } label: {
                        Text("#\(t)").font(AL.Font.chip).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                            .padding(.horizontal, 12).frame(height: 32)
                            .overlay(Capsule().strokeBorder(AL.ink.opacity(AL.Ink.a16)))
                    }
                }
                if let d = DateSections.date(link.createdAt) {
                    Text("Saved \(d.formatted(date: .abbreviated, time: .omitted))")
                        .font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                }
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, -20)
        .contentMargins(.horizontal, 20, for: .scrollContent)
    }

    // MARK: Note

    private var noteCard: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "pencil").font(.subheadline.weight(.semibold)).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
            if editingNote {
                TextField("Why you saved this, what to do with it…", text: $noteDraft, axis: .vertical)
                    .font(AL.Font.brand(14, .regular, relativeTo: .subheadline))
                    .focused($noteFocused)
                    .submitLabel(.done)
                    .onSubmit { noteFocused = false }
            } else {
                Text(link.note ?? "")
                    .font(AL.Font.brand(14, .regular, relativeTo: .subheadline))
                    .foregroundStyle(AL.ink)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(14)
        .background(AL.lime.opacity(0.22), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .contentShape(Rectangle())
        .onTapGesture { if !editingNote { beginNote() } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(editingNote ? "Note" : "Note, \(link.note ?? "")")
        .accessibilityHint(editingNote ? "" : "Edits the note")
    }

    private func beginNote() {
        noteDraft = link.note ?? ""
        editingNote = true
        noteFocused = true
    }

    private func commitNote() {
        guard editingNote else { return }
        editingNote = false
        let text = noteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        if text != (link.note ?? "") { store.setNote(link.id, text) }
    }

    // MARK: Content

    @ViewBuilder
    private var content: some View {
        if link.contentType == .video {
            video
        } else if link.contentType == .recipe, let template, template.hasRecipe {
            RecipeCard(data: template)
        } else {
            if link.contentType == .article, store.isPro { articleHeader(link.templateData) }
            if ArticleBody.hasEnoughProse(link.articleText) {
                HighlightableText(
                    blocks: link.articleText ?? [],
                    highlights: (link.highlights ?? []).map(\.quote)
                ) { store.addHighlight(link.id, quote: $0) }
            } else {
                if !link.excerpt.isEmpty { lead(link.excerpt) }
                // Only an article is missing something without its text; a product or recipe page never had prose to give.
                if link.contentType == .article {
                    Notice("The site wouldn't give up the full page, so this is the summary only. Open the original to read the rest.")
                }
            }
        }
        if let upsell {
            Button { router.sheet = .paywall } label: { Notice(upsell) }
                .buttonStyle(.plain)
        }
    }

    /// The article template's byline, and the summary when the full text follows it.
    @ViewBuilder
    private func articleHeader(_ t: TemplateData?) -> some View {
        if let byline = t?.byline {
            Text(byline).font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
        }
        if ArticleBody.hasEnoughProse(link.articleText), !link.excerpt.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text("SUMMARY").font(AL.Font.eyebrow).tracking(1.47).foregroundStyle(AL.ink.opacity(AL.Ink.a45))
                Text(link.excerpt).font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a85))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(AL.ink.opacity(AL.Ink.a06), in: RoundedRectangle(cornerRadius: AL.Radius.tile, style: .continuous))
            .accessibilityElement(children: .combine)
        }
    }

    /// The video variant, or with Pro and a YouTube or Vimeo id, the player behind the same poster.
    @ViewBuilder
    private var video: some View {
        let embed = template?.embedURL
        Group {
            if playing, let embed {
                VideoWebView(url: embed).accessibilityLabel("Video player")
            } else {
                Button { if embed == nil { router.openOriginal = url } else { playing = true } } label: {
                    HeroImage(link: link).overlay {
                        Image(systemName: "play.fill")
                            .font(.title2.weight(.semibold)).foregroundStyle(.white)
                            .frame(width: 56, height: 56)
                            .background(.black.opacity(0.45), in: Circle())
                    }
                }
                .buttonStyle(TilePressStyle())
                .accessibilityLabel(embed == nil ? "Play on \(link.domain)" : "Play video")
            }
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(16 / 9, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
        if let meta = template?.videoMeta {
            Text(meta).font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
        }
        if !link.excerpt.isEmpty { lead(link.excerpt) }
        if embed == nil {
            Notice("Video — open the original to watch. AnyLink stores the description and thumbnail only.")
        }
    }

    /// The generic layout's last line (S15). Tapping it opens the paywall.
    private var upsell: String? {
        guard !store.isPro else { return nil }
        return switch link.contentType {
        case .article: "Pro adds the summary, the author and the date here."
        case .video: "Pro plays the video right here."
        case .recipe: "Pro turns this into a recipe: ingredients to tick off, numbered steps and the times."
        case .product: "Pro tracks this price for you and charts its history."
        case .note, .image: nil
        }
    }

    private func lead(_ text: String) -> some View {
        Text(text)
            .font(AL.Font.readerBody)
            .lineSpacing(11)
            .foregroundStyle(AL.ink.opacity(AL.Ink.a85))
    }

    // MARK: Also in

    @ViewBuilder
    private var alsoIn: some View {
        let others = store.alsoIn(link)
        if !others.isEmpty, store.collection(link.collectionId)?.isInbox != true {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Also in \(store.name(of: link.collectionId))").font(AL.Font.rowTitle).foregroundStyle(AL.ink)
                    Spacer()
                    Button("See all") { router.open(.collection(link.collectionId)) }
                        .font(.subheadline.weight(.semibold)).foregroundStyle(AL.signal)
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(others.prefix(10)) { other in
                            Button { router.open(.link(other.id)) } label: { MiniCard(link: other) }
                                .buttonStyle(TilePressStyle())
                        }
                    }
                }
                .padding(.horizontal, -20)
                .contentMargins(.horizontal, 20, for: .scrollContent)
            }
        }
    }

    // MARK: Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button { store.setFavorite(link.id, link.favorite != true) } label: {
                Image(systemName: link.favorite == true ? "star.fill" : "star")
                    .foregroundStyle(link.favorite == true ? AL.signal : AL.ink)
            }
            .accessibilityLabel(link.favorite == true ? "Unfavorite" : "Favorite")
            Menu { LinkMenuItems(link: link, inDetail: true) } label: { Image(systemName: "ellipsis") }
                .accessibilityLabel("More")
        }
        ToolbarItemGroup(placement: .bottomBar) {
            // No Highlight button: selecting text offers Highlight in the edit menu, and summary-only links have nothing to select.
            Button("Note", systemImage: "square.and.pencil") { beginNote() }
            if let url { ShareLink(item: url) { Label("Share", systemImage: "square.and.arrow.up") } }
            Spacer()
            Button { router.openOriginal = url } label: { Text("Open ↗").fontWeight(.semibold).foregroundStyle(AL.onAccent) }
                .buttonStyle(.glassProminent)
                .tint(AL.signal)
        }
    }
}

struct MiniCard: View {
    let link: LinkItem
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HeroImage(link: link)
                .frame(height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text(link.title).font(AL.Font.tileTitle).foregroundStyle(AL.ink).lineLimit(2, reservesSpace: true)
            Text(link.domain).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
        }
        .padding(6)
        .frame(width: 150)
        .frosted(0.62, radius: 16)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Previews


@MainActor
private func readerPreview(_ id: String, plan: String = "pro") -> some View {
    let env = AppEnvironment.mock(latency: false, plan: plan)
    return NavigationStack { LinkDetailView(id: id) }
        .environment(env.store)
        .environment(env.router)
}

#Preview("Article") { readerPreview("nasa") }
#Preview("Article — Dark") { readerPreview("nasa").preferredColorScheme(.dark) }
#Preview("Article — Free") { readerPreview("nasa", plan: "free") }
#Preview("Article — Free, Dark") { readerPreview("nasa", plan: "free").preferredColorScheme(.dark) }
#Preview("Video") { readerPreview("ytrt") }
#Preview("Video — Dark") { readerPreview("ytrt").preferredColorScheme(.dark) }
#Preview("Video — Free") { readerPreview("ytrt", plan: "free") }
#Preview("Video — Free, Dark") { readerPreview("ytrt", plan: "free").preferredColorScheme(.dark) }
#Preview("Recipe") { readerPreview("ramen") }
#Preview("Recipe — Dark") { readerPreview("ramen").preferredColorScheme(.dark) }
#Preview("Recipe — Free") { readerPreview("ramen", plan: "free") }
#Preview("Recipe — Free, Dark") { readerPreview("ramen", plan: "free").preferredColorScheme(.dark) }
#Preview("Summary only") { readerPreview("glass") }
#Preview("Large type") { readerPreview("nasa").dynamicTypeSize(.accessibility2) }
