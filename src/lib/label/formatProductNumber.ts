import { normalizeSingleLineText } from "./fitText";

export function formatProductNumber(value: string | undefined): string {
  const normalized = normalizeSingleLineText(value ?? "").trim();
  return normalized;
}
