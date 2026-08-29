import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdfPreviewDialog } from "./PdfPreviewDialog";

describe("PdfPreviewDialog", () => {
  it("offers both generated PDFs and opens the table PDF by default", () => {
    const html = renderToStaticMarkup(
      <PdfPreviewDialog
        open
        documents={[
          { id: "labels", label: "ラベルPDF", fileName: "labels.pdf", url: "blob:labels" },
          { id: "table", label: "一覧PDF", fileName: "table.pdf", url: "blob:table" },
        ]}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("ラベルPDF");
    expect(html).toContain("一覧PDF");
    expect(html).toContain('src="blob:table#view=FitH&amp;toolbar=1"');
    expect(html).toContain("表示中のPDFを保存");
  });
});
