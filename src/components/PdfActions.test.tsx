import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdfActions } from "./PdfActions";

const BASE_PROPS = {
  selectedCount: 1,
  totalPages: 1,
  labelWidthMm: 58,
  disabled: false,
  downloads: [],
  loading: false,
  previewLoading: false,
  macAvailable: true,
  runningInMacApp: true,
  macLoading: false,
  appName: "LABEL PRINT",
  pdfTitle: "秋冬商品一覧",
  onPdfTitleChange: vi.fn(),
  onGenerate: vi.fn(),
  onPreview: vi.fn(),
  onMacPrint: vi.fn(),
};

describe("PdfActions printer readiness", () => {
  it("shows an editable PDF title without an automatic issue date", () => {
    const html = renderToStaticMarkup(
      <PdfActions {...BASE_PROPS} macPrintReady />,
    );

    expect(html).toContain('value="秋冬商品一覧"');
    expect(html).not.toContain("発行");
  });

  it("disables direct printing and explains the blocker while the printer is unavailable", () => {
    const html = renderToStaticMarkup(
      <PdfActions
        {...BASE_PROPS}
        macPrintReady={false}
        macPrintBlockedReason="保存したプリンターが見つかりません"
      />,
    );

    expect(html).toContain('class="mac-print-button" type="button" disabled=""');
    expect(html).toContain("保存したプリンターが見つかりません");
    expect(html).toContain("画面上部のプリンター診断を確認してください");
  });

  it("enables direct printing after the printer diagnostic is ready", () => {
    const html = renderToStaticMarkup(
      <PdfActions {...BASE_PROPS} macPrintReady />,
    );

    expect(html).not.toContain('class="mac-print-button" type="button" disabled=""');
    expect(html).toContain("保存した印刷先へ1ページずつ直接送信します");
  });

  it("keeps the direct-print button disabled for the full native print operation", () => {
    const html = renderToStaticMarkup(
      <PdfActions {...BASE_PROPS} macPrintReady macLoading />,
    );

    expect(html).toContain('class="mac-print-button" type="button" disabled=""');
    expect(html).toContain("印刷処理中…");
  });

  it("shows one ZIP download link containing both PDFs", () => {
    const html = renderToStaticMarkup(
      <PdfActions
        {...BASE_PROPS}
        macPrintReady
        downloads={[
          { fileName: "catalog.zip", url: "blob:catalog" },
        ]}
      />,
    );

    expect(html).toContain("PDF ZIPを保存");
    expect(html).toContain('download="catalog.zip"');
    expect(html).not.toContain("ラベルPDF</a>");
    expect(html).not.toContain("一覧PDF</a>");
    expect(html).toContain("PDFを確認");
  });

  it("offers a PDF preview before saving the ZIP", () => {
    const html = renderToStaticMarkup(
      <PdfActions {...BASE_PROPS} macPrintReady />,
    );

    expect(html).toContain("PDFを確認");
    expect(html).toContain("PDFをZIPで保存");
  });
});
