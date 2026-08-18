import { LockIcon } from "./Icons";
import type { PdfDownload } from "../lib/pdf/generateLabels";

type PdfActionsProps = {
  selectedCount: number;
  totalPages: number;
  labelWidthMm: number;
  disabled: boolean;
  download: PdfDownload | null;
  loading: boolean;
  macAvailable: boolean;
  macLoading: boolean;
  shortcutName: string;
  onGenerate: () => void;
  onMacPrint: () => void;
};

export function PdfActions({
  selectedCount,
  totalPages,
  labelWidthMm,
  disabled,
  download,
  loading,
  macAvailable,
  macLoading,
  shortcutName,
  onGenerate,
  onMacPrint,
}: PdfActionsProps) {
  const busy = loading || macLoading;
  return (
    <footer className="pdf-actions">
      <div className="pdf-summary">
        <span>選択中: <strong>{selectedCount}</strong> 件</span>
        <span>ラベル: <strong>{labelWidthMm}</strong> mm × 高さ自動</span>
        <span>総ページ数: <strong>{totalPages}</strong> ページ</span>
      </div>
      <div className="privacy-note"><LockIcon />データはこの端末内だけで処理されます</div>
      <div className="pdf-action-buttons">
        <div className={`pdf-save-controls ${download && !loading ? "is-ready" : ""}`}>
          {loading ? (
            <button className="save-pdf-button" type="button" disabled>PDFを作成中…</button>
          ) : download ? (
            <>
              <a className="save-pdf-button download-button" href={download.url} download={download.fileName}>PDFを保存</a>
              <button className="regenerate-button" type="button" disabled={disabled || busy} onClick={onGenerate}>再作成</button>
            </>
          ) : (
            <button className="save-pdf-button" type="button" disabled={disabled || busy} onClick={onGenerate}>PDFを保存</button>
          )}
        </div>
        <button
          className="mac-print-button"
          type="button"
          disabled={disabled || busy || !macAvailable}
          onClick={onMacPrint}
        >
          {macLoading ? "印刷PDFを準備中…" : "mC-Label3で印刷"}
        </button>
        <p className={`shortcut-note ${macAvailable ? "" : "is-unavailable"}`}>
          {macAvailable
            ? <>高さが違うラベルも1ページずつ印刷します。Macショートカット「{shortcutName}」が必要です。</>
            : <>mC-Label3への直接印刷はMacで利用できます。PDF保存は引き続き利用できます。</>}
        </p>
      </div>
    </footer>
  );
}
