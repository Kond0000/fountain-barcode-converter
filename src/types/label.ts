import type { FieldMapping } from "./mapping";

export type LabelSettings = {
  widthMm: number;
  marginMm: number;
};

export type LabelElement =
  | { type: "text"; sourceField: string; role: "brand" | "productNumber" | "productName" | "price" | "barcodeValue" }
  | { type: "compositeText"; sourceFields: string[]; separator: string; role: "variant" }
  | { type: "barcode"; sourceField: string; barcodeType: "code128" };

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 58,
  marginMm: 3,
};

export const HORIZONTAL_MARGIN_RATIO = 0.8;
export const PRODUCT_NAME_MAX_CHARACTERS_PER_LINE = 28;

export function calculateHorizontalMargin(verticalMarginMm: number): number {
  if (!Number.isFinite(verticalMarginMm) || verticalMarginMm <= 0) return 0;
  return Math.round(verticalMarginMm * HORIZONTAL_MARGIN_RATIO * 10) / 10;
}

export const LABEL_LAYOUT_MM = {
  itemGap: 1.3,
  sectionGap: 2.1,
  barcodeValueGap: 0.6,
  brand: { fontSize: 2.5, lineHeight: 3.2, weight: 600 },
  productName: { fontSize: 3.2, minFontSize: 3, lineHeight: 4.4, weight: 500 },
  variant: { fontSize: 2.8, lineHeight: 3.6, weight: 500 },
  price: { fontSize: 3.8, lineHeight: 4.8, weight: 600 },
  barcodeHeight: 11.5,
  barcodeValue: { fontSize: 2.4, lineHeight: 3, weight: 500 },
  productNumber: { fontSize: 2.8, lineHeight: 3.6, weight: 500 },
  detailsBox: { itemGap: 0.8 },
} as const;

export function createDefaultLabelElements(
  mapping: FieldMapping,
  options: { includeBrand?: boolean } = {},
): LabelElement[] {
  const elements: LabelElement[] = [];
  if (options.includeBrand !== false && mapping.brand) {
    elements.push({ type: "text", sourceField: mapping.brand, role: "brand" });
  }
  if (mapping.productName) elements.push({ type: "text", sourceField: mapping.productName, role: "productName" });

  if (mapping.color || mapping.size) {
    elements.push({
      type: "compositeText",
      sourceFields: [mapping.color ?? "", mapping.size ?? ""],
      separator: " / ",
      role: "variant",
    });
  }
  if (mapping.price) elements.push({ type: "text", sourceField: mapping.price, role: "price" });
  if (mapping.barcode) {
    elements.push({ type: "barcode", sourceField: mapping.barcode, barcodeType: "code128" });
    elements.push({ type: "text", sourceField: mapping.barcode, role: "barcodeValue" });
  }
  if (mapping.productNumber) {
    elements.push({ type: "text", sourceField: mapping.productNumber, role: "productNumber" });
  }
  return elements;
}
