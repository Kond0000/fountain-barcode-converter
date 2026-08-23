import { describe, expect, it } from "vitest";
import { calculatePreviewFitScale } from "./LabelPreview";

describe("calculatePreviewFitScale", () => {
  it("keeps labels at their natural size when they already fit", () => {
    expect(calculatePreviewFitScale(400, 300, 330, 240)).toBe(1);
  });

  it("scales a tall label to the available preview height", () => {
    expect(calculatePreviewFitScale(400, 250, 330, 500)).toBe(0.5);
  });

  it("uses the stricter dimension when both dimensions are constrained", () => {
    expect(calculatePreviewFitScale(240, 200, 330, 220)).toBeCloseTo(240 / 330);
  });
});
