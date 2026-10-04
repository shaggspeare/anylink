import Testing
import Models

@Suite struct CopyTests {
    @Test func linkCountPluralizes() {
        #expect(0.linkCount == "0 links")
        #expect(1.linkCount == "1 link")
        #expect(2.linkCount == "2 links")
    }
}
