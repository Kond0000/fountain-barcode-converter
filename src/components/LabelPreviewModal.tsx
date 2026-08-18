import { useEffect, useRef, type MouseEvent } from "react";
import type { LabelPdfEntry } from "../lib/pdf/generateLabels";
import type { LabelSettings } from "../types/label";
import type { FieldMapping } from "../types/mapping";
import { CloseIcon } from "./Icons";
import { LabelVisual } from "./LabelVisual";

type LabelPreviewModalProps = {
  open: boolean;
  entries: LabelPdfEntry[];
  mapping: FieldMapping;
  settings: LabelSettings;
  onClose: () => void;
};

function getEntryTitle(entry: LabelPdfEntry, mapping: FieldMapping, index: number): string {
  const barcode = mapping.barcode ? entry.row[mapping.barcode]?.trim() : "";
  const productName = mapping.productName ? entry.row[mapping.productName]?.trim() : "";
  return barcode || productName || `商品 ${index + 1}`;
}

export function LabelPreviewModal({ open, entries, mapping, settings, onClose }: LabelPreviewModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const totalPages = entries.reduce((total, entry) => total + Math.max(0, Math.floor(entry.copies)), 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="preview-modal"
      aria-labelledby="preview-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      onClick={handleBackdropClick}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="preview-modal-shell">
        <header className="preview-modal-header">
          <div>
            <h2 id="preview-modal-title">プレビュー一覧</h2>
            <p>印刷対象 {entries.length}件・合計 {totalPages}枚</p>
          </div>
          <button className="modal-close-button" type="button" onClick={onClose} aria-label="プレビュー一覧を閉じる">
            <CloseIcon />
          </button>
        </header>
        <div className="preview-modal-body">
          {open && entries.length > 0 ? (
            <div className="preview-modal-grid">
              {entries.map((entry, index) => {
                const title = getEntryTitle(entry, mapping, index);
                return (
                  <article className="preview-modal-card" key={`${title}-${index}`} aria-label={`${title}のラベル`}>
                    <div className="preview-modal-item-meta">
                      <strong>{title}</strong>
                      <span>×{Math.max(0, Math.floor(entry.copies))}枚</span>
                    </div>
                    <div className="preview-modal-label-stage">
                      <LabelVisual row={entry.row} mapping={mapping} settings={settings} maxWidthPx={260} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="preview-modal-empty">印刷対象の商品がありません。</p>}
        </div>
        <footer className="preview-modal-footer">
          <p>現在のラベル設定をすべてのプレビューに反映しています。</p>
          <button className="secondary-button" type="button" onClick={onClose}>閉じる</button>
        </footer>
      </div>
    </dialog>
  );
}
