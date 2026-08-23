import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PdfActions } from "./PdfActions";

const BASE_PROPS = {
  selectedCount: 1,
  totalPages: 1,
  labelWidthMm: 58,
  disabled: false,
  download: null,
  loading: false,
  macAvailable: true,
  runningInMacApp: true,
  macLoading: false,
  appName: "LABEL PRINT",
  onGenerate: vi.fn(),
  onMacPrint: vi.fn(),
};

describe("PdfActions printer readiness", () => {
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
});
