import { describe, expect, it } from "vitest";
import {
  calculateBwipHeightMm,
  calculateIntegerModuleScale,
  calculatePrinterAlignedWidth,
} from "./generateCode128";

describe("printer-native CODE128 sizing", () => {
  it("uses the largest whole-dot module width that fits", () => {
    expect(calculateIntegerModuleScale(101, 450)).toBe(4);
    expect(101 * calculateIntegerModuleScale(101, 450)).toBeLessThanOrEqual(450);
  });

  it("keeps supersampled module widths aligned to native printer dots", () => {
    expect(calculateIntegerModuleScale(100, 550, 2)).toBe(4);
    expect(calculateIntegerModuleScale(100, 650, 2)).toBe(6);
  });

  it("uses the full printable width while keeping edges on printer dots", () => {
    expect(calculatePrinterAlignedWidth(550, 2)).toBe(550);
    expect(calculatePrinterAlignedWidth(551, 2)).toBe(550);
    expect(calculatePrinterAlignedWidth(201.8)).toBe(201);
  });

  it("never shrinks a module below one printer dot", () => {
    expect(() => calculateIntegerModuleScale(101, 100)).toThrow("バーコードがラベル幅に収まりません");
    expect(() => calculateIntegerModuleScale(101, 150, 2)).toThrow("バーコードがラベル幅に収まりません");
  });

  it("converts target dots to the native bwip-js height without image scaling", () => {
    expect(calculateBwipHeightMm(96, 3)).toBeCloseTo(11.1713, 4);
  });
});
