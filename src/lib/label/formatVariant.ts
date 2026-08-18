export const EMPTY_VARIANT_VALUE = "-";

export function formatVariantValue(value: string | null | undefined): string {
  return value?.trim() || EMPTY_VARIANT_VALUE;
}
