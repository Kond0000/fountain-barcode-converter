import { describe, expect, it } from "vitest";
import {
  calculateLabelPageCount,
  createPdfPageSize,
  downsampleRgbaToMonochrome,
  labelPrintPixelsToCupsMm,
  labelPrintPixelsToMm,
  labelPrintPixelsToPdfPoints,
  labelRenderPixelsToMm,
  LABEL_CUPS_RASTER_DPI,
  LABEL_MONOCHROME_THRESHOLD,
  LABEL_PRINT_DOTS_PER_MM,
  LABEL_PRINT_DPI,
  LABEL_RENDER_DPI,
  LABEL_RENDER_SCALE,
  mmToLabelPrintPixels,
  mmToLabelRenderPixels,
  snapCoordinateToPrinterDot,
} from "./generateLabels";

describe("label PDF metadata", () => {
  it("uses the mC-Label3 native 8 dots per millimetre grid", () => {
    expect(LABEL_PRINT_DOTS_PER_MM).toBe(8);
    expect(LABEL_PRINT_DPI).toBeCloseTo(203.2, 10);
    expect(LABEL_CUPS_RASTER_DPI).toBe(203);
  });

  it("creates a 2x raster source while preserving whole printer dots", () => {
    expect(LABEL_RENDER_DPI).toBeCloseTo(406.4, 10);
    expect(LABEL_RENDER_SCALE).toBe(2);
    expect(LABEL_RENDER_DPI / LABEL_PRINT_DPI).toBe(LABEL_RENDER_SCALE);
  });

  it("keeps the editable 50 mm width on the native printer grid", () => {
    expect(mmToLabelPrintPixels(50)).toBe(400);
    expect(labelPrintPixelsToMm(400)).toBe(50);
    const renderPixels = mmToLabelRenderPixels(50);
    expect(renderPixels).toBe(800);
    expect(labelRenderPixelsToMm(renderPixels)).toBe(50);
    expect(renderPixels / LABEL_RENDER_SCALE).toBe(400);
  });

  it("maps the default 58 mm width to exactly 464 printer dots and 928 render pixels", () => {
    expect(mmToLabelPrintPixels(58)).toBe(464);
    expect(labelPrintPixelsToMm(464)).toBe(58);
    const renderPixels = mmToLabelRenderPixels(58);
    expect(renderPixels).toBe(928);
    expect(labelRenderPixelsToMm(renderPixels)).toBe(58);
    expect(renderPixels / LABEL_RENDER_SCALE).toBe(464);
  });

  it("maps PDF and CUPS dimensions to the driver's integer 203 dpi raster", () => {
    expect(labelPrintPixelsToPdfPoints(464) * LABEL_CUPS_RASTER_DPI / 72).toBeCloseTo(464, 10);
    expect(labelPrintPixelsToCupsMm(464) * LABEL_CUPS_RASTER_DPI / 25.4).toBeCloseTo(464, 10);
    expect(labelPrintPixelsToCupsMm(464)).toBeCloseTo(58.057143, 6);
  });

  it("snaps arbitrary millimetre values to whole printer dots before supersampling", () => {
    const renderPixels = mmToLabelRenderPixels(50.1);
    expect(renderPixels).toBe(802);
    expect(renderPixels % LABEL_RENDER_SCALE).toBe(0);
  });

  it("uses exact 60 x 66.72 mm page dimensions", () => {
    const [widthPt, heightPt] = createPdfPageSize(60, 66.72);
    expect(widthPt * 25.4 / 72).toBeCloseTo(60, 10);
    expect(heightPt * 25.4 / 72).toBeCloseTo(66.72, 10);
  });

  it("counts one PDF page per requested copy", () => {
    expect(calculateLabelPageCount([
      { row: { code: "A" }, copies: 3 },
      { row: { code: "B" }, copies: 2 },
    ])).toBe(5);
  });

  it("averages antialiased coverage before applying the final monochrome threshold", () => {
    const black = [0, 0, 0, 255];
    const white = [255, 255, 255, 255];
    const transparentBlack = [0, 0, 0, 0];
    const source = new Uint8ClampedArray([
      ...white, ...white,
      ...black, ...white,
      ...black, ...black,
      ...black, ...black,
      ...black, ...black,
      ...transparentBlack, ...transparentBlack,
      ...white, ...white,
      ...white, ...white,
      ...white, ...white,
      ...black, ...white,
      ...black, ...black,
      ...transparentBlack, ...transparentBlack,
    ]);

    const result = downsampleRgbaToMonochrome(source, 12, 2);

    expect(LABEL_MONOCHROME_THRESHOLD).toBe(128);
    expect(result.width).toBe(6);
    expect(result.height).toBe(1);
    expect(Array.from(result.data)).toEqual([
      255, 255, 255, 255,
      255, 255, 255, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);
  });

  it("snaps barcode origins and text baselines to the 2x printer grid", () => {
    expect(snapCoordinateToPrinterDot(43)).toBe(44);
    expect(snapCoordinateToPrinterDot(123)).toBe(124);
    expect(snapCoordinateToPrinterDot(124)).toBe(124);
  });

  it("rejects raster dimensions that cannot map to whole printer dots", () => {
    expect(() => downsampleRgbaToMonochrome(new Uint8ClampedArray(3 * 2 * 4), 3, 2)).toThrow(
      "ラベル画像をプリンタードットへ変換できませんでした。",
    );
  });
});
