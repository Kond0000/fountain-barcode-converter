import { describe, expect, it } from "vitest";
import { mmToPt } from "./mmToPt";

describe("mmToPt", () => {
  it("converts physical millimetres to PDF points", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 8);
    expect(mmToPt(50)).toBeCloseTo(141.732, 3);
  });
});
