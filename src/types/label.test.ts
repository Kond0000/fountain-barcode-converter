import { describe, expect, it } from "vitest";
import { calculateHorizontalMargin, createDefaultLabelElements, DEFAULT_LABEL_SETTINGS, LABEL_LAYOUT_MM } from "./label";

describe("label settings", () => {
  it("only stores values that the user can edit", () => {
    expect(DEFAULT_LABEL_SETTINGS).toEqual({ widthMm: 50, marginMm: 3 });
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

  it("keeps related items closer than separate content groups", () => {
    expect(LABEL_LAYOUT_MM.sectionGap).toBeGreaterThan(LABEL_LAYOUT_MM.itemGap);
    expect(LABEL_LAYOUT_MM.itemGap).toBeGreaterThan(LABEL_LAYOUT_MM.barcodeValueGap);
  });

  it("prioritizes a single-line product name down to 1 mm", () => {
    expect(LABEL_LAYOUT_MM.productName.minFontSize).toBe(1);
    expect(LABEL_LAYOUT_MM.productName.minFontSize).toBeLessThan(LABEL_LAYOUT_MM.productName.fontSize);
  });
});
