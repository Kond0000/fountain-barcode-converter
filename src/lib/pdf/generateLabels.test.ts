import { describe, expect, it } from "vitest";
import {
  calculateLabelPageCount,
  createPdfPageSize,
  LABEL_PRINT_DOTS_PER_MM,
  LABEL_PRINT_DPI,
  LABEL_RENDER_DPI,
  LABEL_RENDER_SCALE,
  mmToLabelRenderPixels,
} from "./generateLabels";

describe("label PDF metadata", () => {
  it("uses the mC-Label3 native 8 dots per millimetre grid", () => {
    expect(LABEL_PRINT_DOTS_PER_MM).toBe(8);
    expect(LABEL_PRINT_DPI).toBeCloseTo(203.2, 10);
  });

  it("creates a 2x raster source while preserving whole printer dots", () => {
    expect(LABEL_RENDER_DPI).toBeCloseTo(406.4, 10);
    expect(LABEL_RENDER_SCALE).toBe(2);
    expect(LABEL_RENDER_DPI / LABEL_PRINT_DPI).toBe(LABEL_RENDER_SCALE);
  });

  it("maps 50 mm to exactly 400 printer dots and 800 render pixels", () => {
    const renderPixels = mmToLabelRenderPixels(50);
    expect(renderPixels).toBe(800);
    expect(renderPixels / LABEL_RENDER_SCALE).toBe(400);
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
});
