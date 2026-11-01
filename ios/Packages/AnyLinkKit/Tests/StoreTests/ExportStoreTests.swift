import Testing
import Foundation
import Models
import Networking
import Fixtures
import Store

@MainActor
@Suite struct ExportStoreTests {
    @Test func exportHandsBackTheFileOrSaysWhyNot() async throws {
        let api = MockAPI.fixtures(latency: false)
        let s = LibraryStore(api: api, snapshot: Fixtures.library)
        let file = try #require(await s.export(.html))
        #expect(FileManager.default.fileExists(atPath: file.path()))
        #expect(s.toasts.current == nil)

        await api.failNext(.proRequired)
        #expect(await s.export(.csv) == nil)
        #expect(s.toasts.current?.message == "That's a Pro feature.")

        await api.failNext(.offline)
        #expect(await s.export(.json) == nil)
        #expect(s.toasts.current?.message == "You're offline. Export needs a connection.")
    }
}
