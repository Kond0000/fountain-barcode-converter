#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PACKAGE_DIR="$ROOT_DIR/macos/LabelPrintMac"
ARM_BUILD_DIR="$PACKAGE_DIR/.build-arm64"
INTEL_BUILD_DIR="$PACKAGE_DIR/.build-x86_64"
OUTPUT_DIR="$ROOT_DIR/dist-macos"
APP_PATH="$OUTPUT_DIR/LABEL PRINT.app"
ZIP_PATH="$OUTPUT_DIR/LABEL-PRINT-mac.zip"
ICON_SOURCE="$ROOT_DIR/public/favicon.svg"

npm run build --prefix "$ROOT_DIR"
swift build --package-path "$PACKAGE_DIR" --scratch-path "$ARM_BUILD_DIR" --triple arm64-apple-macosx13.0 -c release
swift build --package-path "$PACKAGE_DIR" --scratch-path "$INTEL_BUILD_DIR" --triple x86_64-apple-macosx13.0 -c release

rm -rf -- "$APP_PATH"
mkdir -p "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources"
cp "$PACKAGE_DIR/Resources/Info.plist" "$APP_PATH/Contents/Info.plist"
lipo -create \
  "$ARM_BUILD_DIR/arm64-apple-macosx/release/LabelPrintMac" \
  "$INTEL_BUILD_DIR/x86_64-apple-macosx/release/LabelPrintMac" \
  -output "$APP_PATH/Contents/MacOS/LabelPrintMac"
cp "$ROOT_DIR/scripts/mclabel3-print-example.sh" "$APP_PATH/Contents/Resources/mclabel3-print.sh"
cp -R "$ROOT_DIR/dist" "$APP_PATH/Contents/Resources/WebApp"

ICON_WORK_DIR="$(mktemp -d "$OUTPUT_DIR/.label-print-icon.XXXXXX")"
ICONSET_DIR="$ICON_WORK_DIR/AppIcon.iconset"
mkdir -p "$ICONSET_DIR"
/usr/bin/qlmanage -t -s 1024 -o "$ICON_WORK_DIR" "$ICON_SOURCE" >/dev/null
ICON_MASTER="$ICON_WORK_DIR/$(basename "$ICON_SOURCE").png"
[[ -f "$ICON_MASTER" ]] || { print -ru2 -- "アプリアイコンを生成できませんでした"; exit 1; }

while read -r FILE_NAME PIXELS; do
  /usr/bin/sips -z "$PIXELS" "$PIXELS" "$ICON_MASTER" --out "$ICONSET_DIR/$FILE_NAME" >/dev/null
done <<'ICON_SIZES'
icon_16x16.png 16
icon_16x16@2x.png 32
icon_32x32.png 32
icon_32x32@2x.png 64
icon_128x128.png 128
icon_128x128@2x.png 256
icon_256x256.png 256
icon_256x256@2x.png 512
icon_512x512.png 512
icon_512x512@2x.png 1024
ICON_SIZES

/usr/bin/iconutil -c icns "$ICONSET_DIR" -o "$APP_PATH/Contents/Resources/AppIcon.icns"
rm -rf -- "$ICON_WORK_DIR"
chmod 755 "$APP_PATH/Contents/MacOS/LabelPrintMac" "$APP_PATH/Contents/Resources/mclabel3-print.sh"

rm -f -- "$ZIP_PATH"
/usr/bin/ditto --norsrc -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

print -r -- "未署名アプリを作成しました: $APP_PATH"
print -r -- "配布用ZIPを作成しました: $ZIP_PATH"
