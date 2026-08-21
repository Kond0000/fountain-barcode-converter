#!/bin/zsh

# macOS Shortcutsの「シェルスクリプトを実行」へ貼り付ける例です。
# Shortcut InputのJSONテキストを「引数として」渡し、$1で受け取ります。

JOB_JSON="${1-}"

fail() {
  print -r -- "ERROR:$1"
  exit 0
}

[[ -n "$JOB_JSON" ]] || fail "印刷ジョブが空です"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/mclabel-print.XXXXXX")" || fail "一時フォルダーを作成できません"
cleanup() {
  [[ -n "$WORK_DIR" && -d "$WORK_DIR" ]] && rm -rf -- "$WORK_DIR"
}
trap cleanup EXIT

JOB_PLIST="$WORK_DIR/job.plist"
print -rn -- "$JOB_JSON" > "$JOB_PLIST"
/usr/bin/plutil -convert xml1 "$JOB_PLIST" 2>/dev/null || fail "印刷ジョブJSONが不正です"

plist_value() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$2" 2>/dev/null
}

VERSION="$(plist_value version "$JOB_PLIST")" || fail "印刷ジョブのversionがありません"
JOB_ID="$(plist_value jobId "$JOB_PLIST")" || fail "印刷ジョブIDがありません"
ARCHIVE_NAME="$(plist_value archiveName "$JOB_PLIST")" || fail "ZIPファイル名がありません"
PAGE_COUNT="$(plist_value pageCount "$JOB_PLIST")" || fail "印刷ページ数がありません"

UUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
PAGE_COUNT_PATTERN='^[1-9][0-9]{0,5}$'
DIMENSION_PATTERN='^([1-9][0-9]*|0\.[0-9]{1,3}|[1-9][0-9]*\.[0-9]{1,3})$'
PAGE_FILE_PATTERN='^mclabel-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}-p[0-9]{6}-[0-9]+(\.[0-9]{1,3})?x[0-9]+(\.[0-9]{1,3})?mm\.pdf$'

[[ "$VERSION" == "2" ]] || fail "未対応の印刷ジョブversionです"
[[ "$JOB_ID" =~ $UUID_PATTERN ]] || fail "印刷ジョブIDが不正です"
[[ "$PAGE_COUNT" =~ $PAGE_COUNT_PATTERN ]] || fail "印刷ページ数が不正です"
(( PAGE_COUNT <= 65534 )) || fail "印刷ページ数が上限を超えています"
[[ "$ARCHIVE_NAME" == "mclabel-${JOB_ID}.zip" ]] || fail "ZIPファイル名が不正です"

ARCHIVE_FILE="$HOME/Downloads/$ARCHIVE_NAME"
for _ in {1..40}; do
  [[ -f "$ARCHIVE_FILE" && ! -L "$ARCHIVE_FILE" ]] && break
  sleep 0.25
done
[[ -f "$ARCHIVE_FILE" && ! -L "$ARCHIVE_FILE" ]] || fail "印刷ZIPが見つかりません"

ZIP_LIST="$(/usr/bin/unzip -Z1 "$ARCHIVE_FILE" 2>/dev/null)" || fail "印刷ZIPを読み込めません"
ENTRY_COUNT=0
while IFS= read -r ENTRY; do
  [[ "$ENTRY" == "manifest.json" || "$ENTRY" =~ $PAGE_FILE_PATTERN ]] || fail "印刷ZIP内に不正なファイルがあります"
  (( ENTRY_COUNT += 1 ))
done <<< "$ZIP_LIST"
(( ENTRY_COUNT == PAGE_COUNT + 1 )) || fail "印刷ZIPのファイル数が一致しません"

EXTRACT_DIR="$WORK_DIR/files"
mkdir "$EXTRACT_DIR" || fail "展開先を作成できません"
/usr/bin/unzip -qq "$ARCHIVE_FILE" -d "$EXTRACT_DIR" || fail "印刷ZIPを展開できません"

MANIFEST_PLIST="$EXTRACT_DIR/manifest.json"
[[ -f "$MANIFEST_PLIST" && ! -L "$MANIFEST_PLIST" ]] || fail "manifest.jsonがありません"
/usr/bin/plutil -convert xml1 "$MANIFEST_PLIST" 2>/dev/null || fail "manifest.jsonが不正です"

MANIFEST_VERSION="$(plist_value version "$MANIFEST_PLIST")" || fail "manifestのversionがありません"
MANIFEST_JOB_ID="$(plist_value jobId "$MANIFEST_PLIST")" || fail "manifestのジョブIDがありません"
MANIFEST_PAGE_COUNT="$(plist_value pageCount "$MANIFEST_PLIST")" || fail "manifestのページ数がありません"
[[ "$MANIFEST_VERSION" == "2" ]] || fail "未対応のmanifest versionです"
[[ "$MANIFEST_JOB_ID" == "$JOB_ID" ]] || fail "印刷ジョブIDが一致しません"
[[ "$MANIFEST_PAGE_COUNT" == "$PAGE_COUNT" ]] || fail "印刷ページ数が一致しません"

PRINTERS=()
while IFS= read -r DESTINATION; do
  [[ "${DESTINATION:u}" == *MCL32* ]] && PRINTERS+=("$DESTINATION")
done < <(lpstat -e 2>/dev/null)

case ${#PRINTERS[@]} in
  0) fail "mC-Label3が見つかりません" ;;
  1) PRINTER="${PRINTERS[1]}" ;;
  *) fail "mC-Label3が複数存在します" ;;
esac

OPTIONS="$(lpoptions -p "$PRINTER" -l 2>/dev/null)" || fail "プリンターオプションを取得できません"
[[ "$OPTIONS" == *"Custom.WIDTHxHEIGHT"* ]] || fail "Custom PageSize非対応です"

printer_option_supports() {
  local option_name="$1"
  local option_value="$2"
  local option_line choice
  while IFS= read -r option_line; do
    [[ "$option_line" == "$option_name/"*:* ]] || continue
    for choice in ${(z)${option_line#*:}}; do
      [[ "${choice#\*}" == "$option_value" ]] && return 0
    done
  done <<< "$OPTIONS"
  return 1
}

JOB_OPTIONS=()
printer_option_supports "Halftoning" "1Monochrome" && JOB_OPTIONS+=(-o "Halftoning=1Monochrome")
printer_option_supports "PrintSpeed" "2Low" && JOB_OPTIONS+=(-o "PrintSpeed=2Low")

INDEX=0
while (( INDEX < PAGE_COUNT )); do
  FILE_NAME="$(plist_value "pages:${INDEX}:fileName" "$MANIFEST_PLIST")" || fail "$((INDEX + 1))ページ目のPDF名がありません"
  WIDTH_MM="$(plist_value "pages:${INDEX}:widthMm" "$MANIFEST_PLIST")" || fail "$((INDEX + 1))ページ目の幅がありません"
  HEIGHT_MM="$(plist_value "pages:${INDEX}:heightMm" "$MANIFEST_PLIST")" || fail "$((INDEX + 1))ページ目の高さがありません"

  [[ "$WIDTH_MM" =~ $DIMENSION_PATTERN ]] || fail "$((INDEX + 1))ページ目の幅が不正です"
  [[ "$HEIGHT_MM" =~ $DIMENSION_PATTERN ]] || fail "$((INDEX + 1))ページ目の高さが不正です"
  PAGE_NUMBER="$(printf '%06d' "$((INDEX + 1))")"
  EXPECTED_FILE_NAME="mclabel-${JOB_ID}-p${PAGE_NUMBER}-${WIDTH_MM}x${HEIGHT_MM}mm.pdf"
  [[ "$FILE_NAME" == "$EXPECTED_FILE_NAME" ]] || fail "$((INDEX + 1))ページ目のPDF名と寸法が一致しません"

  FILE="$EXTRACT_DIR/$FILE_NAME"
  [[ -f "$FILE" && ! -L "$FILE" ]] || fail "$((INDEX + 1))ページ目のPDFがありません"
  LP_OUTPUT="$(lp -d "$PRINTER" -o "media=Custom.${WIDTH_MM}x${HEIGHT_MM}mm" "${JOB_OPTIONS[@]}" -- "$FILE" 2>&1)"
  LP_STATUS=$?
  [[ $LP_STATUS -eq 0 ]] || fail "$((INDEX + 1))ページ目のlp印刷失敗: $LP_OUTPUT"
  (( INDEX += 1 ))
done

if plist_value "pages:${PAGE_COUNT}:fileName" "$MANIFEST_PLIST" >/dev/null; then
  fail "manifestに余分なページがあります"
fi

print -r -- "OK:${PAGE_COUNT}ページを個別の用紙サイズで受け付けました"
