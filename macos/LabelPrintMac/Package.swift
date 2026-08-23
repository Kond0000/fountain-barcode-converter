// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "LabelPrintMac",
  platforms: [.macOS(.v13)],
  products: [
    .executable(name: "LabelPrintMac", targets: ["LabelPrintMac"]),
  ],
  targets: [
    .executableTarget(name: "LabelPrintMac"),
  ],
  swiftLanguageModes: [.v5],
)
