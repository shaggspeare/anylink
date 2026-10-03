// swift-tools-version: 6.2
// Template for Packages/AnyLinkKit/Package.swift — copy in Phase 0.
// If the installed toolchain is older than 6.2, lower the tools version to what `swift --version` reports (≥ 6.0).
import PackageDescription

let package = Package(
    name: "AnyLinkKit",
    defaultLocalization: "en",
    platforms: [.iOS(.v26), .macOS(.v26)],   // macOS only so `swift test` runs on the Mac without a simulator
    products: [
        .library(name: "Models", targets: ["Models"]),
        .library(name: "QueryLanguage", targets: ["QueryLanguage"]),
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Persistence", targets: ["Persistence"]),
        .library(name: "Store", targets: ["Store"]),
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "Fixtures", targets: ["Fixtures"]),
    ],
    targets: [
        .target(name: "Models"),
        .target(name: "QueryLanguage", dependencies: ["Models"]),
        .target(name: "Networking", dependencies: ["Models"]),
        .target(name: "Persistence", dependencies: ["Models"]),
        .target(name: "Store", dependencies: ["Models", "QueryLanguage", "Networking", "Persistence"]),
        .target(name: "DesignSystem", dependencies: ["Models"], resources: [.process("Resources")]),   // Fonts/*.ttf
        .target(name: "Fixtures", dependencies: ["Models", "Networking"], resources: [.copy("Resources")]), // library.json, crawl-*.ndjson

        .testTarget(name: "ModelsTests", dependencies: ["Models", "Fixtures"]),
        .testTarget(name: "QueryLanguageTests", dependencies: ["QueryLanguage", "Fixtures"]),
        .testTarget(name: "NetworkingTests", dependencies: ["Networking", "Fixtures"]),
        .testTarget(name: "StoreTests", dependencies: ["Store", "Fixtures"]),
    ],
    swiftLanguageModes: [.v6]
)
