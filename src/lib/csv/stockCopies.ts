export function normalizePrintCopies(copies: number): number {
  return Number.isFinite(copies) ? Math.min(999, Math.max(0, Math.floor(copies))) : 1;
}

export function getStockCopies(value?: string): number {
  const normalized = value?.normalize("NFKC").trim() ?? "";
  if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(normalized)) return 1;
  return normalizePrintCopies(Number(normalized.replace(/,/g, "")));
}
