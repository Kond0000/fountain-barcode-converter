export const DEFAULT_PDF_TITLE_BASE = "バーコード一覧";

export function formatPdfIssueDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日発行`;
}

export function normalizePdfTitleBase(value: string): string {
  return value.trim() || DEFAULT_PDF_TITLE_BASE;
}

function sanitizePdfFileStem(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
}

export function createPdfTitles(
  titleBase: string,
  date: Date,
): { pageTitle: string; labelsFileName: string; tableFileName: string; archiveFileName: string } {
  const normalizedTitleBase = normalizePdfTitleBase(titleBase);
  const issueDate = formatPdfIssueDate(date);
  const pageTitle = `${normalizedTitleBase} - ${issueDate}`;
  return {
    pageTitle,
    labelsFileName: `${sanitizePdfFileStem(`${normalizedTitleBase} - バーコード別 - ${issueDate}`)}.pdf`,
    tableFileName: `${sanitizePdfFileStem(pageTitle)}.pdf`,
    archiveFileName: `${sanitizePdfFileStem(pageTitle)}.zip`,
  };
}
