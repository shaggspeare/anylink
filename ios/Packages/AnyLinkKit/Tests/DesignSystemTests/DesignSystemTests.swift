import Testing
@testable import DesignSystem

@MainActor
@Suite struct ToastCenterTests {
    @Test func newToastReplacesOld() {
        let c = ToastCenter()
        c.show("A")
        c.show("B")
        #expect(c.current?.message == "B")
        c.dismiss()
        #expect(c.current == nil)
    }

    @Test func identityIsStable() {
        #expect(AL.identity(for: "nasa.gov").tint == AL.identity(for: "nasa.gov").tint)
        #expect(AL.identity(for: "nasa.gov").initial == "N")
    }
}
