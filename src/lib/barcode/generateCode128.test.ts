import { describe, expect, it } from "vitest";
import { calculateBwipHeightMm, calculateIntegerModuleScale } from "./generateCode128";

describe("printer-native CODE128 sizing", () => {
  it("uses the largest whole-dot module width that fits", () => {
    expect(calculateIntegerModuleScale(101, 450)).toBe(4);
    expect(101 * calculateIntegerModuleScale(101, 450)).toBeLessThanOrEqual(450);
  });

  it("never shrinks a module below one printer dot", () => {
    expect(() => calculateIntegerModuleScale(101, 100)).toThrow("バーコードがラベル幅に収まりません");
  });

  it("converts target dots to the native bwip-js height without image scaling", () => {
    expect(calculateBwipHeightMm(96, 3)).toBeCloseTo(11.1713, 4);
  });
});
