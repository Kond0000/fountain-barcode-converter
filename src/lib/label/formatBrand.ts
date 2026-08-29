import { normalizeSingleLineText } from "./fitText";

export const DEFAULT_BRAND_NAME = "FOUNTAIN";

export function formatBrandName(value: string): string {
  return normalizeSingleLineText(value).trim() || DEFAULT_BRAND_NAME;
}
