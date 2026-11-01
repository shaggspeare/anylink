import Foundation
import Models
import Networking

extension LibraryStore {
    /// Settings → Export (Pro): the library as a file in the temp directory, or nil after saying why not. A free
    /// account gets the paywall (`report`, S19).
    public func export(_ format: ExportFormat) async -> URL? {
        do {
            return try await api.export(format: format)
        } catch AppError.offline {
            toasts.show("You're offline. Export needs a connection.")
        } catch {
            report(error)
        }
        return nil
    }
}
