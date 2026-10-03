import SwiftUI
import TipKit
import DesignSystem
import Models
import QueryLanguage
import Networking
import Fixtures
import Store

/// S13.
struct SearchView: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var model: SearchModel
    @State private var savingFilter = false
    @State private var filterName = ""

    init(store: LibraryStore) {
        _model = State(initialValue: SearchModel(store: store))
    }

    var body: some View {
        ScrollViewReader { proxy in
            List {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Search")
                        .font(AL.Font.largeTitle).tracking(-1.65)
                        .foregroundStyle(AL.ink)
                        .accessibilityAddTraits(.isHeader)
                        .id("top")
                    narrow
                }
                .plainRow()
                if model.isEmpty { emptyState } else { results }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .onChange(of: router.scrollToTop[.search]) { withAnimation { proxy.scrollTo("top", anchor: .top) } }
        }
        .background { ZStack { AL.canvas; Orbs(.library) }.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $model.text, tokens: $model.tokens, placement: .automatic, prompt: "Search links, #tags…") { token in
            Text(token.label)
        }
        .onSubmit(of: .search) { model.run() }
        .alert("Save as filter", isPresented: $savingFilter) {
            TextField("Name", text: $filterName)
            Button("Save") { Task { await model.saveAsFilter(name: filterName) } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(model.query.string)
        }
    }

    // MARK: Narrow it down

    private var narrow: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Narrow it down").font(.footnote).foregroundStyle(AL.ink.opacity(AL.Ink.a55))
                .popoverTip(SearchTip())
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(model.suggestedTokens) { t in
                        let on = model.isActive(t)
                        Button { model.toggle(t) } label: {
                            HStack(spacing: 4) {
                                if on { Image(systemName: "checkmark").font(.caption2.weight(.bold)) }
                                Text(t.label)
                            }
                            .font(AL.Font.chip)
                            .foregroundStyle(on ? AL.onInk : AL.ink.opacity(AL.Ink.a75))
                            .padding(.horizontal, 12).frame(height: 32)
                            .background(on ? AnyShapeStyle(AL.ink) : AnyShapeStyle(.clear), in: Capsule())
                            .overlay(Capsule().strokeBorder(AL.ink.opacity(on ? 0 : AL.Ink.a20)))
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(on ? .isSelected : [])
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.horizontal, -16)
            .sensoryFeedback(.selection, trigger: model.tokens.count)
        }
    }

    // MARK: Empty query

    @ViewBuilder
    private var emptyState: some View {
        Section {
            ForEach(model.recent) { LinkListRow(link: $0) }
        } header: {
            sectionHeader("Recently saved")
        }
        if !store.customFilters.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                sectionHeader("Saved filters")
                FlowLayout(spacing: 8) {
                    ForEach(store.customFilters) { f in
                        Button { router.open(.filter(Query(f.smartQuery ?? ""), title: f.name)) } label: { ScopeChip(f.name) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .plainRow()
        }
        Text("Try async, #space or ramen. Search looks inside summaries and notes too.")
            .font(AL.Font.lead)
            .foregroundStyle(AL.ink.opacity(AL.Ink.a55))
            .plainRow()
    }

    // MARK: Results

    @ViewBuilder
    private var results: some View {
        Section {
            if model.results.isEmpty {
                Text("No matches.").font(AL.Font.lead).foregroundStyle(AL.ink.opacity(AL.Ink.a55)).plainRow()
            }
            ForEach(model.results) { link in
                SearchResultRow(link: link, model: model)
            }
            if model.total > SearchModel.limit {
                Button("Show all \(model.total) matches") { router.open(.filter(model.query, title: model.query.string)) }
                    .font(.subheadline.weight(.semibold)).foregroundStyle(AL.signal)
                    .plainRow()
            }
        } header: {
            HStack {
                sectionHeader("Links · \(model.total)")
                Spacer()
                Button("Save as filter") {
                    filterName = model.defaultFilterName
                    savingFilter = true
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(AL.signal)
                .disabled(model.total == 0)
            }
        }
        if !model.matchingCollections.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                sectionHeader("Collections")
                FlowLayout(spacing: 8) {
                    ForEach(model.matchingCollections) { c in
                        Button { router.open(c.isSmart == true ? .filter(Query(c.smartQuery ?? ""), title: c.name) : .collection(c.id)) } label: {
                            ScopeChip(c.name, count: store.count(in: c.id))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .plainRow()
        }
    }

    private func sectionHeader(_ t: String) -> some View {
        Text(t).font(AL.Font.rowTitle).foregroundStyle(AL.ink).textCase(nil)
    }
}

private struct SearchResultRow: View {
    let link: LinkItem
    let model: SearchModel
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        Button { router.open(.link(link.id)) } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 12) {
                    HeroImage(link: link)
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(highlighted(link.title)).font(AL.Font.rowTitle).foregroundStyle(AL.ink).lineLimit(2)
                        Text([link.domain, store.name(of: link.collectionId)].joined(separator: " · "))
                            .font(.caption).foregroundStyle(AL.ink.opacity(AL.Ink.a50)).lineLimit(1)
                    }
                    Spacer(minLength: 0)
                }
                if let s = model.snippet(for: link) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(s.label).font(AL.Font.eyebrow).tracking(1.0).textCase(.uppercase)
                            .foregroundStyle(AL.ink.opacity(AL.Ink.a50))
                        Text(highlighted(s.text)).font(AL.Font.body).foregroundStyle(AL.ink.opacity(AL.Ink.a75)).lineLimit(3)
                    }
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(AL.ink.opacity(AL.Ink.a05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .padding(.leading, 56)
                }
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(Color.clear.frosted(0.62, radius: 0, rim: 0))
        .linkActions(link)
        .accessibilityElement(children: .combine)
    }

    private func highlighted(_ s: String) -> AttributedString {
        var a = AttributedString(s)
        for r in model.highlightRanges(in: s) {
            if let ar = Range(r, in: a) {
                a[ar].backgroundColor = AL.lime
                a[ar].foregroundColor = AL.onAccent
            }
        }
        return a
    }
}

private extension View {
    func plainRow() -> some View {
        listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
            .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
    }
}

#Preview("Search") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SearchView(store: env.store) }.environment(env.store).environment(env.router)
}

#Preview("Search — Dark") {
    let env = AppEnvironment.mock(latency: false)
    NavigationStack { SearchView(store: env.store) }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
