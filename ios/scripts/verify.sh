#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Pick a simulator
SIM=$(xcrun simctl list devices available | grep -m1 "iPhone 17 Pro" | sed 's/.*(\([A-F0-9-]*\)).*/\1/')
DEST="platform=iOS Simulator,id=${SIM}"

echo "==> xcodegen generate"
xcodegen generate

echo "==> swift test --package-path Packages/AnyLinkKit"
swift test --package-path Packages/AnyLinkKit

echo "==> xcodebuild build"
EXTRA_FLAGS=""
if [ "${CI:-}" = "true" ]; then
    EXTRA_FLAGS="OTHER_SWIFT_FLAGS=\$(inherited)\ -warnings-as-errors"
fi

xcodebuild \
    -scheme AnyLink \
    -destination "${DEST}" \
    ${EXTRA_FLAGS} \
    build

echo "✓ verify passed"
