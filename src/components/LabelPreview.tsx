import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { CsvRow } from "../types/csv";
import { calculateHorizontalMargin, type LabelSettings } from "../types/label";
import type { FieldMapping } from "../types/mapping";
import { CloseIcon } from "./Icons";
import { LabelVisual } from "./LabelVisual";
import { SectionHeader } from "./SectionHeader";

type LabelPreviewProps = {
  row?: CsvRow;
  mapping: FieldMapping;
  settings: LabelSettings;
  selectedCount: number;
  onOpenList: () => void;
};

function formatMillimeters(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function LabelPreview({ row, mapping, settings, selectedCount, onOpenList }: LabelPreviewProps) {
  const [measuredHeightMm, setMeasuredHeightMm] = useState(0);
  const [scanPreviewOpen, setScanPreviewOpen] = useState(false);
  const scanPreviewDialogRef = useRef<HTMLDialogElement>(null);

  const safeWidth = Number.isFinite(settings.widthMm) ? Math.max(settings.widthMm, 0) : 0;
  const safeVerticalMargin = Number.isFinite(settings.marginMm) ? Math.max(settings.marginMm, 0) : 0;
  const safeHorizontalMargin = calculateHorizontalMargin(safeVerticalMargin);
  const barcodeValue = row && mapping.barcode ? row[mapping.barcode]?.trim() : "";

  useEffect(() => {
    const dialog = scanPreviewDialogRef.current;
    if (!dialog) return;
    if (scanPreviewOpen && !dialog.open) dialog.showModal();
    if (!scanPreviewOpen && dialog.open) dialog.close();
  }, [scanPreviewOpen]);

  const closeScanPreview = () => setScanPreviewOpen(false);

  const handleScanPreviewBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) closeScanPreview();
  };

  return (
    <section className="rail-panel preview-panel">
      <SectionHeader>プレビュー</SectionHeader>
      <div className="preview-stage">
        {row ? (
          <LabelVisual
            row={row}
            mapping={mapping}
            settings={settings}
            onHeightChange={setMeasuredHeightMm}
          />
        ) : <p className="preview-empty">プレビューする商品がありません。</p>}
      </div>
      <p className="preview-note" aria-live="polite">
        横幅 {formatMillimeters(safeWidth)} mm・高さ {measuredHeightMm > 0 ? `約${formatMillimeters(measuredHeightMm)} mm` : "自動計算中"}・上下余白 {formatMillimeters(safeVerticalMargin)} mm・左右余白 {formatMillimeters(safeHorizontalMargin)} mm（自動）・CODE128
      </p>
      <button
        className="preview-scan-button"
        type="button"
        disabled={!barcodeValue}
        onClick={() => setScanPreviewOpen(true)}
      >
        読み取り用に拡大表示
      </button>
      <button
        className="preview-list-button"
        type="button"
        disabled={selectedCount === 0}
        onClick={onOpenList}
      >
        選択中のラベルを一覧で確認（{selectedCount}件）
      </button>
      <dialog
        ref={scanPreviewDialogRef}
        className="barcode-scan-modal"
        aria-labelledby="barcode-scan-modal-title"
        onCancel={(event) => {
          event.preventDefault();
          closeScanPreview();
        }}
        onClose={closeScanPreview}
        onClick={handleScanPreviewBackdropClick}
      >
        <div className="barcode-scan-modal-shell">
          <header className="barcode-scan-modal-header">
            <div>
              <h2 id="barcode-scan-modal-title">読み取り用バーコード</h2>
              <p>画面から読み取る場合は、こちらを表示してください。</p>
            </div>
            <button className="modal-close-button" type="button" onClick={closeScanPreview} aria-label="読み取り用バーコードを閉じる">
              <CloseIcon />
            </button>
          </header>
          <div className="barcode-scan-modal-body">
            {row ? (
              <LabelVisual
                row={row}
                mapping={mapping}
                settings={settings}
                maxWidthPx={620}
                pixelsPerMm={10}
                allowOverflow
              />
            ) : null}
          </div>
        </div>
      </dialog>
    </section>
  );
}
