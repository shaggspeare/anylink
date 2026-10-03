import SwiftUI
import DesignSystem
import Models
import Networking
import Fixtures
import Store

/// S14: Sort Unsorted.
struct TriageView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var model: TriageModel

    init(store: LibraryStore) {
        _model = State(initialValue: TriageModel(store: store))
    }

    var body: some View {
        VStack(spacing: 16) {
            if let link = model.current {
                ProgressView(value: model.progress)
                    .tint(AL.lime)
                    .scaleEffect(y: 1.4)
                    .animation(AL.Motion.progress, value: model.progress)
                    .accessibilityHidden(true)   // "{i} of {total}" in the title says it
                suggestionPill(link)
                SwipeCardStack(
                    items: Array(model.remaining.prefix(2)),
                    rightStamp: { model.suggestion(for: $0)?.name ?? "Choose" },
                    leftStamp: "Trash",
                    showsButtons: false,
                    onCommit: { item, dir in commit(item, dir) },
                    card: { TriageCard(link: $0) }
                )
                .padding(.horizontal, 30)
                alternatives(link)
                Spacer(minLength: 0)
                bottomRow(link)
            } else {
                done
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background { ZStack { AL.canvas; Orbs(.inbox) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text("Sort Unsorted").font(.headline)
                    if !model.isDone {
                        Text("\(model.position) of \(model.total)").font(.caption).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Done") { router.setPath(router.tab, router.path(router.tab).dropLast()) }
            }
        }
    }

    private func commit(_ link: LinkItem, _ dir: SwipeDirection) {
        switch dir {
        case .left: model.kill(link)
        case .right:
            if model.suggestion(for: link) != nil { model.accept(link) } else { router.sheet = .moveLinks([link.id]) }
        }
    }

    @ViewBuilder
    private func suggestionPill(_ link: LinkItem) -> some View {
        if let s = model.suggestion(for: link) {
            Text("✦ Looks like \(Text(s.name).bold())")
                .font(AL.Font.chip)
                .foregroundStyle(AL.ink)
                .padding(.horizontal, 12).frame(height: 30)
                .background(AL.periwinkleFill, in: Capsule())
        }
    }

    private func alternatives(_ link: LinkItem) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                Text("Or:").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                ForEach(model.alternatives(for: link)) { c in
                    Button { model.file(link, into: c.id) } label: { ScopeChip(c.name) }
                        .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
        }
        .padding(.horizontal, -16)
    }

    private func bottomRow(_ link: LinkItem) -> some View {
        let s = model.suggestion(for: link)
        return HStack(spacing: 10) {
            Button { model.kill(link) } label: {
                Image(systemName: "trash")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(AL.onInk)
                    .frame(width: 60, height: 60)
                    .background(AL.ink, in: Circle())
            }
            .accessibilityLabel("Move to Trash")
            Button("Later") { model.skip(link) }
                .buttonStyle(.glass)
                .controlSize(.large)
            Button {
                if s != nil { model.accept(link) } else { router.sheet = .moveLinks([link.id]) }
            } label: {
                Text(s.map { "\($0.name) →" } ?? "Choose a collection").lineLimit(1)
            }
            .buttonStyle(.alSignal)
        }
        .sensoryFeedback(.success, trigger: model.remaining.count)
    }

    private var done: some View {
        VStack(spacing: 14) {
            Spacer()
            Image(systemName: "checkmark")
                .font(.title.weight(.bold))
                .foregroundStyle(AL.onAccent)
                .frame(width: 64, height: 64)
                .background(AL.lime, in: Circle())
            Text("Unsorted is clear").font(AL.Font.title).tracking(-0.66).foregroundStyle(AL.ink)
            Text("Everything has a home. New links will land here again until you sort them.")
                .font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                .multilineTextAlignment(.center)
            Button("Back to library") {
                router.setPath(router.tab, [])
                router.tab = .library
            }
            .buttonStyle(.alPrimary)
            .padding(.top, 8)
            Spacer()
        }
        .padding(.horizontal, 20)
    }
}

private struct TriageCard: View {
    let link: LinkItem

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HeroImage(link: link)
                .frame(height: 176)
                .clipShape(RoundedRectangle(cornerRadius: 19, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(meta).font(AL.Font.meta).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
                Text(link.title).font(AL.Font.cardTitleL).tracking(-0.72).foregroundStyle(AL.ink).lineLimit(3)
                if !link.excerpt.isEmpty {
                    Text(link.excerpt).font(AL.Font.body).foregroundStyle(AL.ink.opacity(AL.Ink.a60)).lineLimit(3)
                }
                if !link.tags.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(link.tags.prefix(4), id: \.self) { t in
                            Text("#\(t)").font(AL.Font.chip).foregroundStyle(AL.ink.opacity(AL.Ink.a75))
                                .padding(.horizontal, 10).frame(height: 26)
                                .background(AL.ink.opacity(AL.Ink.a06), in: Capsule())
                        }
                    }
                }
            }
            .padding(.horizontal, 8)
            .padding(.bottom, 12)
        }
        .padding(8)
        .accessibilityElement(children: .combine)
    }

    private var meta: String {
        [link.domain, link.readingMeta, link.source.map { "saved from \($0.capitalized)" }].compactMap { $0 }.joined(separator: " · ")
    }
}

#Preview("Triage") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { TriageView(store: env.store) }.environment(env.store).environment(env.router)
}

#Preview("Triage — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { TriageView(store: env.store) }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
