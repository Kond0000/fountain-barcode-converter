export function formatPrice(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^[¥￥$€£]/.test(trimmed)) return trimmed;
  const normalized = trimmed.replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return trimmed;
  return `¥${Number(normalized).toLocaleString("ja-JP")}`;
}
