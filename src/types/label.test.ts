import { describe, expect, it } from "vitest";
import {
  calculateHorizontalMargin,
  createDefaultLabelElements,
  DEFAULT_LABEL_SETTINGS,
  LABEL_LAYOUT_MM,
  PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
} from "./label";

describe("label settings", () => {
  it("only stores values that the user can edit", () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({ widthMm: 58, marginMm: 3 });
  });

  it("calculates the horizontal margin as 80% of the vertical margin", () => {
    expect(calculateHorizontalMargin(3)).toBe(2.4);
    expect(calculateHorizontalMargin(3.3)).toBe(2.6);
  });

  it("includes the brand in the printable label elements", () => {
    expect(createDefaultLabelElements({ brand: "ブランド", productName: "商品名" })).toEqual([
      { type: "text", sourceField: "ブランド", role: "brand" },
      { type: "text", sourceField: "商品名", role: "productName" },
    ]);
  });

  it("keeps the product number as visible text without changing the encoded barcode field", () => {
    expect(createDefaultLabelElements({ barcode: "商品コード", productNumber: "グループコード" })).toEqual([
      { type: "barcode", sourceField: "商品コード", barcodeType: "code128" },
      { type: "text", sourceField: "商品コード", role: "barcodeValue" },
      { type: "text", sourceField: "グループコード", role: "productNumber" },
    ]);
  });

  it("keeps related items closer than separate content groups", () => {
    expect(LABEL_LAYOUT_MM.sectionGap).toBeGreaterThan(LABEL_LAYOUT_MM.itemGap);
    expect(LABEL_LAYOUT_MM.itemGap).toBeGreaterThan(LABEL_LAYOUT_MM.barcodeValueGap);
  });

  it("keeps product names legible before wrapping after 28 characters", () => {
    expect(PRODUCT_NAME_MAX_CHARACTERS_PER_LINE).toBe(28);
    expect(LABEL_LAYOUT_MM.productName.minFontSize).toBe(3);
    expect(LABEL_LAYOUT_MM.productName.minFontSize).toBeGreaterThan(
      LABEL_LAYOUT_MM.variant.fontSize,
    );
    expect(LABEL_LAYOUT_MM.productName.minFontSize).toBeLessThan(LABEL_LAYOUT_MM.productName.fontSize);
  });

  it("makes the right-aligned price larger than the variant values", () => {
    expect(LABEL_LAYOUT_MM.price.fontSize).toBeGreaterThan(LABEL_LAYOUT_MM.variant.fontSize);
  });
});
