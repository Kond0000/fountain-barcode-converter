import { describe, expect, it } from "vitest";
import { mmToPt } from "../units/mmToPt";
import {
  BARCODE_TABLE_ACCENT_COLOR,
  BARCODE_TABLE_CARD_COLUMNS,
  BARCODE_TABLE_CARD_ROWS,
  BARCODE_TABLE_ITEMS_PER_PAGE,
  BARCODE_TABLE_PAGE_HEIGHT_MM,
  BARCODE_TABLE_PAGE_WIDTH_MM,
  BARCODE_TABLE_PIXELS_PER_MM,
  calculateBarcodeTablePageCount,
  createBarcodeTableCardSize,
  createBarcodeTablePageSize,
  formatBarcodeTableBrand,
  getBarcodeTableEntries,
  formatBarcodeTableCodeValue,
  formatBarcodeTableVariant,
  normalizeCatalogImageBackgroundPixels,
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

  it("renders the catalog page at about 406 dpi", () => {
    expect(BARCODE_TABLE_PIXELS_PER_MM).toBe(16);
    expect(BARCODE_TABLE_PIXELS_PER_MM * 25.4).toBeCloseTo(406.4);
  });

  it("shows only color and size separated by a full-width bar", () => {
    expect(formatBarcodeTableVariant(["Brown", "M"]))
      .toBe("Brown｜M");
    expect(formatBarcodeTableVariant(["Brown"]))
      .toBe("Brown");
    expect(formatBarcodeTableVariant([]))
      .toBe("-");
  });

  it("uses FOUNTAIN when the brand is empty", () => {
    expect(formatBarcodeTableBrand("")).toBe("FOUNTAIN");
    expect(formatBarcodeTableBrand("   ")).toBe("FOUNTAIN");
    expect(formatBarcodeTableBrand("Kelen")).toBe("Kelen");
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

  it("turns only edge-connected near-white image backgrounds pure white", () => {
    const pixels = new Uint8ClampedArray([
      238, 238, 236, 255, 238, 238, 236, 255, 238, 238, 236, 255,
      238, 238, 236, 255, 20, 20, 20, 255, 238, 238, 236, 255,
      238, 238, 236, 255, 238, 238, 236, 255, 238, 238, 236, 255,
    ]);

    normalizeCatalogImageBackgroundPixels(pixels, 3, 3);

    expect(Array.from(pixels.slice(0, 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(pixels.slice(16, 20))).toEqual([20, 20, 20, 255]);
  });
});
