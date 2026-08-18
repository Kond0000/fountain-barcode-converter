import { describe, expect, it } from "vitest";
import { calculateLabelPageCount, createPdfPageSize } from "./generateLabels";

describe("label PDF metadata", () => {
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
