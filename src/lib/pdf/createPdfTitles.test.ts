import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_TITLE_BASE,
  createPdfTitles,
  normalizePdfTitleBase,
} from "./createPdfTitles";

describe("PDF titles", () => {
  it("uses only the entered text for the page title and filenames", () => {
    expect(createPdfTitles("秋冬商品一覧")).toEqual({
      pageTitle: "秋冬商品一覧",
      labelsFileName: "秋冬商品一覧 - バーコード別.pdf",
      tableFileName: "秋冬商品一覧.pdf",
      archiveFileName: "秋冬商品一覧.zip",
    });
  });

  it("falls back to a default title and removes filename control characters", () => {
    expect(normalizePdfTitleBase("   ")).toBe(DEFAULT_PDF_TITLE_BASE);
    expect(createPdfTitles("秋/冬:商品*一覧").tableFileName)
      .toBe("秋-冬-商品-一覧.pdf");
  });
});
