import { describe, expect, it } from "vitest";
import { formatProductNumber } from "./formatProductNumber";

describe("formatProductNumber", () => {
  it("returns only the item number", () => {
    expect(formatProductNumber("271033")).toBe("271033");
  });

  it("normalizes whitespace and omits empty values", () => {
    expect(formatProductNumber("  271033\n ")).toBe("271033");
    expect(formatProductNumber("   ")).toBe("");
    expect(formatProductNumber(undefined)).toBe("");
  });
});
