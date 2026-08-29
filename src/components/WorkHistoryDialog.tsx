import {
  WORK_HISTORY_MAX_ENTRIES,
  WORK_HISTORY_RETENTION_DAYS,
  type WorkHistorySummary,
} from "../lib/history/workHistory";
import { SettingsDialog } from "./SettingsDialog";

type WorkHistoryDialogProps = {
  error?: string;
  histories: WorkHistorySummary[];
  loading: boolean;
  open: boolean;
  onClose: () => void;
  onDelete: (history: WorkHistorySummary) => void;
  onRestore: (history: WorkHistorySummary) => void;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function WorkHistoryDialog({
  error,
  histories,
  loading,
  open,
  onClose,
  onDelete,
  onRestore,
}: WorkHistoryDialogProps) {
  return (
    <SettingsDialog
      dialogId="work-history-dialog"
      open={open}
      title="作業履歴"
      description={`PDFを作成した時点の作業を、この端末に${WORK_HISTORY_RETENTION_DAYS}日間・最大${WORK_HISTORY_MAX_ENTRIES}件保存します。PDF本体は保存せず、容量に応じて古い履歴から自動整理します。`}
      onClose={onClose}
    >
      <section className="work-history-panel" aria-busy={loading}>
        {loading ? (
          <p className="work-history-empty">作業履歴を読み込み中…</p>
        ) : error ? (
          <p className="work-history-error" role="alert">{error}</p>
        ) : histories.length === 0 ? (
          <p className="work-history-empty">保存された作業履歴はありません。PDFを作成すると、ここから復元できるようになります。</p>
        ) : (
          <ol className="work-history-list">
            {histories.map((history) => (
              <li key={history.id}>
                <div className="work-history-copy">
                  <time dateTime={new Date(history.savedAt).toISOString()}>
                    {dateTimeFormatter.format(history.savedAt)}
                  </time>
                  <strong>{history.pdfTitle || "バーコード一覧"}</strong>
                  <span>{history.csvFileName}</span>
                  <small>
                    {history.rowCount}行・選択 {history.selectedCount}件
                    {history.imageCount > 0 ? `・画像 ${history.imageCount}点` : "・画像なし"}
                  </small>
                </div>
                <div className="work-history-actions">
                  <button className="work-history-restore" type="button" onClick={() => onRestore(history)}>
                    この作業を開く
                  </button>
                  <button className="work-history-delete" type="button" onClick={() => onDelete(history)}>
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </SettingsDialog>
  );
}
