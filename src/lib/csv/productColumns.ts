import type { FieldMapping } from "../../types/mapping";

export type ProductColumn = {
  key: string;
  label: string;
  field: string;
  kind?: "price";
};

const DEFAULT_GRID_MAPPING_KEYS: ReadonlyArray<keyof FieldMapping> = [
  "barcode",
  "productName",
  "color",
  "size",
  "price",
  "brand",
];

export function getMappedGridFields(mapping: FieldMapping): string[] {
  const fields = DEFAULT_GRID_MAPPING_KEYS.flatMap((key) => {
    const field = mapping[key];
    return field ? [field] : [];
  });
  return [...new Set(fields)];
}

export function createDefaultVisibleFields(headers: string[], mapping: FieldMapping): string[] {
  const mapped = new Set(getMappedGridFields(mapping));
  const defaults = headers.filter((header) => mapped.has(header));
  return defaults.length > 0 ? defaults : headers.slice(0, 5);
}

export function createProductColumns(
  headers: string[],
  mapping: FieldMapping,
  visibleFields: ReadonlySet<string>,
): ProductColumn[] {
  return headers.flatMap((header) => visibleFields.has(header)
    ? [{
      key: header,
      label: header,
      field: header,
      kind: header === mapping.price ? "price" as const : undefined,
    }]
    : []);
}
