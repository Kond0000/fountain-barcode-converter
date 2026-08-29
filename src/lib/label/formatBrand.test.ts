import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND_NAME, formatBrandName } from "./formatBrand";

describe("brand name formatting", () => {
  it("keeps an entered brand on one line", () => {
    expect(formatBrandName("  Kelen\nJapan  ")).toBe("Kelen Japan");
  });

  it("uses FOUNTAIN when the mapped brand value is empty", () => {
    expect(formatBrandName("")).toBe(DEFAULT_BRAND_NAME);
    expect(formatBrandName("   ")).toBe("FOUNTAIN");
  });
});
