import { describe, expect, it } from "vitest";
import {
  explainBarcodePreviewError,
  explainCsvReadError,
  explainDirectPrintError,
  explainPdfGenerationError,
  explainPrinterSettingsError,
} from "./userFacingError";

describe("user-facing errors", () => {
  it("explains how to fix a CSV without headers", () => {
    expect(explainCsvReadError(new Error("CSVヘッダーを読み取れませんでした。"))).toEqual({
      title: "CSVの項目名を確認できませんでした",
      detail: expect.stringContaining("CSVの1行目"),
    });
  });

  it("explains how to fix an empty CSV", () => {
    expect(explainCsvReadError(new Error("CSVに商品データがありません。"))).toEqual({
      title: "CSVに商品データがありません",
      detail: expect.stringContaining("1件以上"),
    });
  });

  it("turns barcode width failures into a settings action", () => {
    const message = explainPdfGenerationError(new Error("バーコードがラベル幅に収まりません。"));
    expect(message.title).toBe("バーコードがラベルの横幅に収まりません");
    expect(message.detail).toContain("横幅を広げる");
  });

  it("does not expose print-job format errors", () => {
    const message = explainDirectPrintError(new Error("印刷ジョブJSONが不正です"), true);
    expect(message.title).toBe("印刷データを準備できませんでした");
    expect(message.detail).not.toContain("JSON");
  });

  it("explains how to recover when ZIP download preparation cannot start", () => {
    const message = explainDirectPrintError(new Error("印刷ファイルの保存準備を開始できませんでした"), true);
    expect(message.title).toBe("印刷ファイルの保存を開始できませんでした");
    expect(message.detail).toContain("最新版");
  });

  it("provides a PDF fallback when the Mac app cannot be launched", () => {
    const message = explainDirectPrintError(new Error("起動失敗"), false);
    expect(message.title).toBe("Mac印刷アプリを起動できませんでした");
    expect(message.detail).toContain("PDF保存");
  });

  it("turns barcode preview failures into a settings action", () => {
    expect(explainBarcodePreviewError(new Error("バーコードの余白が不正です。"))).toContain("上下余白を小さく");
  });

  it("explains how to recover printer bridge errors", () => {
    const message = explainPrinterSettingsError(new Error("プリンター情報の形式が不正です。"), "load");
    expect(message.title).toBe("Macアプリと正しく連携できません");
    expect(message.detail).toContain("最新版");
  });
});
