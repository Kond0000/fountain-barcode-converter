import { useState } from "react";
import type { PdfDownload } from "../lib/pdf/generateLabels";
import { SettingsDialog } from "./SettingsDialog";

export type PdfPreviewDocument = PdfDownload & {
  id: "labels" | "table";
  label: string;
};

type PdfPreviewDialogProps = {
  documents: PdfPreviewDocument[];
  open: boolean;
  onClose: () => void;
};

export function PdfPreviewDialog({ documents, open, onClose }: PdfPreviewDialogProps) {
  const [activeId, setActiveId] = useState<PdfPreviewDocument["id"]>("table");
  const activeDocument = documents.find((document) => document.id === activeId) ?? documents[0];

  return (
    <SettingsDialog
      dialogId="pdf-preview-dialog"
      open={open}
      title="PDFプレビュー"
      description="実際に保存されるラベルPDFと一覧PDFを切り替えて確認できます。"
      onClose={onClose}
    >
      <section className="pdf-preview-panel">
        <div className="pdf-preview-toolbar">
          <div className="pdf-preview-tabs" role="tablist" aria-label="確認するPDF">
            {documents.map((document) => (
              <button
                id={`pdf-preview-tab-${document.id}`}
                className={document.id === activeDocument?.id ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={document.id === activeDocument?.id}
                aria-controls="pdf-preview-frame"
                key={document.id}
                onClick={() => setActiveId(document.id)}
              >
                {document.label}
              </button>
            ))}
          </div>
          {activeDocument ? (
            <a href={activeDocument.url} download={activeDocument.fileName}>
              表示中のPDFを保存
            </a>
          ) : null}
        </div>
        {activeDocument ? (
          <iframe
            id="pdf-preview-frame"
            className="pdf-preview-frame"
            src={`${activeDocument.url}#view=FitH&toolbar=1`}
            title={`${activeDocument.label}のプレビュー`}
            aria-labelledby={`pdf-preview-tab-${activeDocument.id}`}
          />
        ) : (
          <p className="pdf-preview-empty">確認できるPDFがありません。</p>
        )}
      </section>
    </SettingsDialog>
  );
}
