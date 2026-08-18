import { describe, expect, it } from "vitest";
import { shouldStackDetailsRow } from "./layoutDetailsRow";

describe("details row layout", () => {
  it("always gives the price its own row when variant values are present", () => {
    expect(shouldStackDetailsRow({ variant: "VINTAGE BLUE / 24", price: "¥19,800" })).toBe(true);
    expect(shouldStackDetailsRow({ variant: "NAVY / FREE", price: "¥7,700" })).toBe(true);
  });

  it("does not stack when only one side is present", () => {
    expect(shouldStackDetailsRow({ variant: "NAVY / FREE", price: "" })).toBe(false);
    expect(shouldStackDetailsRow({ variant: "", price: "¥7,700" })).toBe(false);
  });
});
