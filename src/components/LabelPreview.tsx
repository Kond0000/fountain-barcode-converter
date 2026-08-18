import { useState } from "react";
import type { CsvRow } from "../types/csv";
import { calculateHorizontalMargin, type LabelSettings } from "../types/label";
import type { FieldMapping } from "../types/mapping";
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

  const safeWidth = Number.isFinite(settings.widthMm) ? Math.max(settings.widthMm, 0) : 0;
  const safeVerticalMargin = Number.isFinite(settings.marginMm) ? Math.max(settings.marginMm, 0) : 0;
  const safeHorizontalMargin = calculateHorizontalMargin(safeVerticalMargin);

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
        className="preview-list-button"
        type="button"
        disabled={selectedCount === 0}
        onClick={onOpenList}
      >
        選択中のラベルを一覧で確認（{selectedCount}件）
      </button>
    </section>
  );
}
