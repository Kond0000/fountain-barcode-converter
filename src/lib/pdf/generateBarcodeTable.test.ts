import { describe, expect, it } from "vitest";
import { mmToPt } from "../units/mmToPt";
import {
  BARCODE_TABLE_ACCENT_COLOR,
  BARCODE_TABLE_METADATA_PRODUCT_GAP_MM,
  BARCODE_TABLE_CARD_COLUMNS,
  BARCODE_TABLE_CARD_ROWS,
  BARCODE_TABLE_COLOR_FONT_SIZE_MM,
  BARCODE_TABLE_COLOR_FONT_WEIGHT,
  BARCODE_TABLE_COLOR_TEXT_COLOR,
  BARCODE_TABLE_ITEMS_PER_PAGE,
  BARCODE_TABLE_PAGE_HEIGHT_MM,
  BARCODE_TABLE_PAGE_WIDTH_MM,
  BARCODE_TABLE_PIXELS_PER_MM,
  BARCODE_TABLE_PRODUCT_COLOR_GAP_MM,
  BARCODE_TABLE_VARIANT_PRICE_GAP_MM,
  calculateBarcodeTablePageCount,
  createBarcodeTableCardSize,
  createBarcodeTablePageSize,
  formatBarcodeTableMetadata,
  formatBarcodeTableSizeTag,
  getBarcodeTableSizeLayout,
  getBarcodeTableVariantColumns,
  getBarcodeTableEntries,
  formatBarcodeTableCodeValue,
  usesBarcodeTablePlaceholder,
} from "./generateBarcodeTable";

describe("barcode card PDF layout", () => {
  it("uses an A4 portrait page", () => {
    expect(createBarcodeTablePageSize()).toEqual([
      mmToPt(BARCODE_TABLE_PAGE_WIDTH_MM),
      mmToPt(BARCODE_TABLE_PAGE_HEIGHT_MM),
    ]);
    expect(BARCODE_TABLE_PAGE_WIDTH_MM).toBe(210);
    expect(BARCODE_TABLE_PAGE_HEIGHT_MM).toBe(297);
  });

  it("uses a four-column by four-row product card grid", () => {
    expect(BARCODE_TABLE_CARD_COLUMNS).toBe(4);
    expect(BARCODE_TABLE_CARD_ROWS).toBe(4);
    expect(BARCODE_TABLE_ITEMS_PER_PAGE).toBe(16);
    expect(createBarcodeTableCardSize()).toEqual({
      widthMm: 48.525,
      heightMm: 64.775,
    });
  });

  it("uses a neutral monochrome accent", () => {
    expect(BARCODE_TABLE_ACCENT_COLOR).toBe("#b8b8b3");
  });

  it("keeps a visible one millimeter gap between the variant and price rows", () => {
    expect(BARCODE_TABLE_VARIANT_PRICE_GAP_MM).toBe(1);
  });

  it("creates a clear hierarchy between product metadata, product name, and color", () => {
    expect(BARCODE_TABLE_METADATA_PRODUCT_GAP_MM).toBe(0.9);
    expect(BARCODE_TABLE_PRODUCT_COLOR_GAP_MM).toBe(0.5);
    expect(BARCODE_TABLE_COLOR_FONT_SIZE_MM).toBe(1.9);
    expect(BARCODE_TABLE_COLOR_FONT_WEIGHT).toBe(700);
    expect(BARCODE_TABLE_COLOR_TEXT_COLOR).toBe("#3f3f3f");
  });

  it("renders the catalog page at about 406 dpi", () => {
    expect(BARCODE_TABLE_PIXELS_PER_MM).toBe(16);
    expect(BARCODE_TABLE_PIXELS_PER_MM * 25.4).toBeCloseTo(406.4);
  });

  it("keeps color and size in separate columns when the color wraps", () => {
    expect(getBarcodeTableVariantColumns(["BLACK/PURPLE_BLACK_BROWN", "1"]))
      .toEqual({ color: "BLACK / PURPLE_BLACK_BROWN", size: "1" });
    expect(getBarcodeTableVariantColumns(["Brown"]))
      .toEqual({ color: "Brown", size: "" });
  });

  it("normalizes the size value for the image tag without changing the color", () => {
    expect(formatBarcodeTableSizeTag("  XL  ")).toBe("SIZE XL");
    expect(formatBarcodeTableSizeTag("ONE\nSIZE")).toBe("SIZE ONE SIZE");
    expect(formatBarcodeTableSizeTag("   ")).toBe("");
  });

  it("uses the aligned image-corner box while retaining the alternate size layouts", () => {
    expect(getBarcodeTableSizeLayout()).toBe("image-corner-box");
  });

  it("places the product number with the product metadata instead of the barcode value", () => {
    expect(formatBarcodeTableMetadata("271033")).toBe("型番: 271033");
    expect(formatBarcodeTableMetadata("")).toBe("");
  });

  it("shows the product code without a CODE prefix", () => {
    expect(formatBarcodeTableCodeValue("ke0032brw", "fallback"))
      .toBe("ke0032brw");
    expect(formatBarcodeTableCodeValue("", "4589876543200"))
      .toBe("4589876543200");
  });

  it("places each selected product once regardless of its label copy count", () => {
    const entries = [
      { row: { code: "A" }, copies: 3 },
      { row: { code: "B" }, copies: 0 },
      { row: { code: "C" }, copies: 12 },
    ];

    expect(getBarcodeTableEntries(entries).map((entry) => entry.row.code)).toEqual(["A", "C"]);
    expect(calculateBarcodeTablePageCount(entries)).toBe(1);
  });

  it("starts a new page after sixteen products", () => {
    const entries = Array.from({ length: BARCODE_TABLE_ITEMS_PER_PAGE + 1 }, (_, index) => ({
      row: { code: String(index) },
      copies: 99,
    }));

    expect(calculateBarcodeTablePageCount(entries)).toBe(2);
  });

  it("uses a placeholder whenever an image was not uploaded", () => {
    const image = new File([new Uint8Array([1])], "item.png", { type: "image/png" });

    expect(usesBarcodeTablePlaceholder({ row: { code: "A" }, copies: 1 })).toBe(true);
    expect(usesBarcodeTablePlaceholder({ row: { code: "A" }, copies: 1, imageFile: image })).toBe(false);
  });

});
