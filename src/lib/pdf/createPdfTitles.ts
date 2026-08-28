export const DEFAULT_PDF_TITLE_BASE = "バーコード一覧";

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
): { pageTitle: string; labelsFileName: string; tableFileName: string; archiveFileName: string } {
  const normalizedTitleBase = normalizePdfTitleBase(titleBase);
  return {
    pageTitle: normalizedTitleBase,
    labelsFileName: `${sanitizePdfFileStem(`${normalizedTitleBase} - バーコード別`)}.pdf`,
    tableFileName: `${sanitizePdfFileStem(normalizedTitleBase)}.pdf`,
    archiveFileName: `${sanitizePdfFileStem(normalizedTitleBase)}.zip`,
  };
}
