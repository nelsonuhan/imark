// swift-tools-version: 6.0
import PackageDescription

// The .app bundle is assembled by build.sh — SwiftPM only produces the
// Mach-O executable that goes inside it, plus the renderer it uses.
let package = Package(
    name: "Imark",
    platforms: [.macOS(.v14)],
    targets: [
        .target(
            name: "ImarkRender",
            path: "Sources/ImarkRender",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
        .executableTarget(
            name: "Imark",
            dependencies: ["ImarkRender"],
            path: "Sources/Imark",
            swiftSettings: [.swiftLanguageMode(.v5)]
        ),
    ]
)
