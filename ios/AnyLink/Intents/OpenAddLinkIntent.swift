import AppIntents
import Foundation

/// The Control Center / Lock Screen button. Opens the app on the Add sheet, which offers the copied link.
/// In both the app and the widget extension, so the system runs it in the app.
struct OpenAddLinkIntent: AppIntent {
    static let title: LocalizedStringResource = "Save Clipboard Link"
    static let description = IntentDescription("Opens AnyLink to save the link you copied.")
    static let supportedModes: IntentModes = .foreground(.immediate)

    func perform() async throws -> some IntentResult & OpensIntent {
        guard let url = URL(string: "anylink://add") else { throw URLError(.badURL) }
        return .result(opensIntent: OpenURLIntent(url))
    }
}
