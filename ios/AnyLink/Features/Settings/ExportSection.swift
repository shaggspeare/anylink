import SwiftUI
import UniformTypeIdentifiers
import DesignSystem
import Models
import Networking
import Fixtures
import Store

/// S18 · Your library: Export (Pro). Pick a format; the file downloads, then the Files save sheet takes it.
/// A dialog, not a `Menu`: in a List, a Menu cuts its label to two lines at the largest text sizes.
struct ExportSection: View {
    @Environment(LibraryStore.self) private var store
    @Environment(Router.self) private var router
    @State private var choosing = false
    @State private var preparing = false
    @State private var file: ExportedFile?

    /// `preparing` is for previews of the spinner.
    init(preparing: Bool = false) { _preparing = State(initialValue: preparing) }

    var body: some View {
        Section {
            Button { choosing = true } label: {
                Label {
                    Text(preparing ? "Preparing your file…" : "Export library")
                } icon: {
                    if preparing { ProgressView() } else { Image(systemName: "square.and.arrow.up") }
                }
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .disabled(preparing)
            .confirmationDialog("Export library", isPresented: $choosing) {
                ForEach(ExportFormat.allCases, id: \.self) { format in
                    Button(format.title) { export(format) }
                }
            }
            .fileExporter(
                isPresented: Binding(get: { file != nil }, set: { if !$0 { file = nil } }),
                document: file,
                contentTypes: [file?.type ?? .data],
                defaultFilename: file?.url.deletingPathExtension().lastPathComponent
            ) { result in
                if case .failure = result { store.toasts.show(LibraryStore.message(for: AppError.unknown)) }
            }
        } header: {
            Text("Your library").foregroundStyle(AL.ink.opacity(AL.Ink.a60))
        } footer: {
            if !store.isPro {
                // Opens the paywall, like a refused export (`LibraryStore.export` → `report`).
                Button { router.sheet = .paywall } label: {
                    Text("Export is a Pro feature.").foregroundStyle(AL.ink.opacity(AL.Ink.a60))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func export(_ format: ExportFormat) {
        preparing = true
        Task {
            file = await store.export(format).map { ExportedFile(url: $0) }
            preparing = false
        }
    }
}

private extension ExportFormat {
    var title: LocalizedStringKey {
        switch self {
        case .html: "Bookmarks (HTML)"
        case .json: "Everything (JSON)"
        case .csv: "Spreadsheet (CSV)"
        }
    }
}

/// The downloaded file, handed to the Files save sheet as it is.
struct ExportedFile: FileDocument {
    static let readableContentTypes: [UTType] = [.html, .json, .commaSeparatedText]
    let url: URL
    var type: UTType { UTType(filenameExtension: url.pathExtension) ?? .data }

    init(url: URL) { self.url = url }
    init(configuration: ReadConfiguration) throws { throw CocoaError(.featureUnsupported) }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { try FileWrapper(url: url) }
}

#Preview("Export") {
    let env = AppEnvironment.mock(latency: false)
    List { ExportSection() }.environment(env.store).environment(env.router)
}

#Preview("Export — Dark") {
    let env = AppEnvironment.mock(latency: false)
    List { ExportSection() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}

#Preview("Export — Preparing") {
    let env = AppEnvironment.mock(latency: false)
    List { ExportSection(preparing: true) }.environment(env.store).environment(env.router)
}

#Preview("Export — Free, Dark") {
    let env = AppEnvironment.mock(latency: false)
    let lib = Fixtures.library
    let _ = env.store.apply(LibrarySnapshot(links: lib.links, trashed: lib.trashed, collections: lib.collections, plan: "free"))
    List { ExportSection() }.environment(env.store).environment(env.router).preferredColorScheme(.dark)
}
