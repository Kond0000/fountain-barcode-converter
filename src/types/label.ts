import type { FieldMapping } from "./mapping";

export type LabelSettings = {
  widthMm: number;
  marginMm: number;
};

export type LabelElement =
  | { type: "text"; sourceField: string; role: "brand" | "productName" | "price" | "barcodeValue" }
  | { type: "compositeText"; sourceFields: string[]; separator: string; role: "variant" }
  | { type: "barcode"; sourceField: string; barcodeType: "code128" };

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 50,
  marginMm: 3,
};

export const HORIZONTAL_MARGIN_RATIO = 0.8;
export const PRODUCT_NAME_MAX_CHARACTERS_PER_LINE = 28;

export function calculateHorizontalMargin(verticalMarginMm: number): number {
  if (!Number.isFinite(verticalMarginMm) || verticalMarginMm <= 0) return 0;
  return Math.round(verticalMarginMm * HORIZONTAL_MARGIN_RATIO * 10) / 10;
}

export const LABEL_LAYOUT_MM = {
  itemGap: 0.9,
  sectionGap: 1.8,
  barcodeValueGap: 0.6,
  brand: { fontSize: 2.5, lineHeight: 3.2, weight: 600 },
  productName: { fontSize: 3.2, minFontSize: 3, lineHeight: 4, weight: 500 },
  variant: { fontSize: 2.8, lineHeight: 3.6, weight: 500 },
  price: { fontSize: 3.8, lineHeight: 4.8, weight: 600 },
  barcodeHeight: 11.5,
  barcodeValue: { fontSize: 2.4, lineHeight: 3, weight: 500 },
} as const;

export function createDefaultLabelElements(mapping: FieldMapping): LabelElement[] {
  const elements: LabelElement[] = [];
  if (mapping.brand) elements.push({ type: "text", sourceField: mapping.brand, role: "brand" });
  if (mapping.productName) elements.push({ type: "text", sourceField: mapping.productName, role: "productName" });

  const variantFields = [mapping.color, mapping.size].filter((field): field is string => Boolean(field));
  if (variantFields.length > 0) {
    elements.push({ type: "compositeText", sourceFields: variantFields, separator: " / ", role: "variant" });
  }
  if (mapping.price) elements.push({ type: "text", sourceField: mapping.price, role: "price" });
  if (mapping.barcode) {
    elements.push({ type: "barcode", sourceField: mapping.barcode, barcodeType: "code128" });
    elements.push({ type: "text", sourceField: mapping.barcode, role: "barcodeValue" });
  }
  return elements;
}
