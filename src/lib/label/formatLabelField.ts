import { normalizeSingleLineText } from "./fitText";

export function formatLabelField(label: string, value: string | undefined): string {
  const normalizedLabel = normalizeSingleLineText(label).trim();
  const normalizedValue = normalizeSingleLineText(value ?? "").trim();
  if (!normalizedValue) return "";
  return normalizedLabel ? `${normalizedLabel}: ${normalizedValue}` : normalizedValue;
}
