// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "AnyLinkKit",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [
        .library(name: "Models", targets: ["Models"]),
        .library(name: "QueryLanguage", targets: ["QueryLanguage"]),
        .library(name: "DesignSystem", targets: ["DesignSystem"]),
        .library(name: "Networking", targets: ["Networking"]),
        .library(name: "Persistence", targets: ["Persistence"]),
        .library(name: "Store", targets: ["Store"]),
        .library(name: "Fixtures", targets: ["Fixtures"]),
    ],
    targets: [
        .target(name: "Models"),
        .target(name: "QueryLanguage", dependencies: ["Models"]),
        .target(name: "DesignSystem", dependencies: ["Models"], resources: [.process("Resources")]),
        .target(name: "Networking", dependencies: ["Models"]),
        .target(name: "Persistence", dependencies: ["Models"]),
        .target(name: "Store", dependencies: ["Models", "QueryLanguage", "Networking", "Persistence"]),
        .target(name: "Fixtures", dependencies: ["Models", "Networking"], resources: [.process("Resources")]),

        .testTarget(name: "ModelsTests", dependencies: ["Models"]),
        .testTarget(name: "QueryLanguageTests", dependencies: ["QueryLanguage"]),
        .testTarget(name: "DesignSystemTests", dependencies: ["DesignSystem"]),
        .testTarget(name: "NetworkingTests", dependencies: ["Networking"]),
        .testTarget(name: "PersistenceTests", dependencies: ["Persistence"]),
        .testTarget(name: "StoreTests", dependencies: ["Store", "Fixtures"]),
        .testTarget(name: "FixturesTests", dependencies: ["Fixtures"]),
    ]
)
