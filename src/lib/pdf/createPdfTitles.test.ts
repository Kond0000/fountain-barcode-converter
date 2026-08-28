import { describe, expect, it } from "vitest";
import {
  DEFAULT_PDF_TITLE_BASE,
  createPdfTitles,
  formatPdfIssueDate,
  normalizePdfTitleBase,
} from "./createPdfTitles";

describe("PDF titles", () => {
  const issueDate = new Date(2026, 7, 28, 12, 0, 0);

  it("formats the issue date in Japanese", () => {
    expect(formatPdfIssueDate(issueDate)).toBe("2026年8月28日発行");
  });

  it("uses the entered text for the table page title and filename", () => {
    expect(createPdfTitles("秋冬商品一覧", issueDate)).toEqual({
      pageTitle: "秋冬商品一覧 - 2026年8月28日発行",
      labelsFileName: "秋冬商品一覧 - バーコード別 - 2026年8月28日発行.pdf",
      tableFileName: "秋冬商品一覧 - 2026年8月28日発行.pdf",
      archiveFileName: "秋冬商品一覧 - 2026年8月28日発行.zip",
    });
  });

  it("falls back to a default title and removes filename control characters", () => {
    expect(normalizePdfTitleBase("   ")).toBe(DEFAULT_PDF_TITLE_BASE);
    expect(createPdfTitles("秋/冬:商品*一覧", issueDate).tableFileName)
      .toBe("秋-冬-商品-一覧 - 2026年8月28日発行.pdf");
  });
});
