import { describe, expect, it } from "vitest";
import { formatVariantValue } from "./formatVariant";

describe("variant value formatting", () => {
  it("trims mapped color and size values", () => {
    expect(formatVariantValue("  NAVY  ")).toBe("NAVY");
  });

  it("renders missing or whitespace-only values as a hyphen", () => {
    expect(formatVariantValue("")).toBe("-");
    expect(formatVariantValue("   ")).toBe("-");
    expect(formatVariantValue(undefined)).toBe("-");
  });
});
