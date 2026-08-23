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
  runningInMacApp: boolean;
  macLoading: boolean;
  macPrintReady: boolean;
  macPrintBlockedReason?: string;
  appName: string;
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
  runningInMacApp,
  macLoading,
  macPrintReady,
  macPrintBlockedReason,
  appName,
  onGenerate,
  onMacPrint,
}: PdfActionsProps) {
  const busy = loading || macLoading;
  return (
    <footer className="pdf-actions">
      <div className="pdf-actions-inner">
        <div className="pdf-action-context">
          <div className="pdf-summary">
            <span>選択中 <strong>{selectedCount}</strong> 件</span>
            <span>ラベル <strong>{labelWidthMm}</strong> mm × 高さ自動</span>
            <span>合計 <strong>{totalPages}</strong> ページ</span>
          </div>
          <div className="privacy-note"><LockIcon />データはこの端末内だけで処理されます</div>
        </div>
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
            disabled={disabled || busy || !macAvailable || (runningInMacApp && !macPrintReady)}
            onClick={onMacPrint}
          >
            {macLoading ? "印刷処理中…" : "mC-Label3で印刷"}
          </button>
          <p className={`shortcut-note ${macAvailable && (!runningInMacApp || macPrintReady) ? "" : "is-unavailable"}`}>
            {macAvailable
              ? runningInMacApp
                ? macPrintReady
                  ? <>高さが違うラベルも、保存した印刷先へ1ページずつ直接送信します。</>
                  : <>{macPrintBlockedReason ?? "プリンターを確認中です"}。画面上部のプリンター診断を確認してください。</>
                : <>高さが違うラベルも1ページずつ印刷します。「{appName}」に保存した印刷先を使用します。</>
              : <>mC-Label3への直接印刷はMacで利用できます。PDF保存は引き続き利用できます。</>}
          </p>
        </div>
      </div>
    </footer>
  );
}
