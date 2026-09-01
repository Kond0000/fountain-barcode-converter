import { describe, expect, it } from "vitest";
import { formatLabelField } from "./formatLabelField";

describe("formatLabelField", () => {
  it("prefixes a populated value with a readable field label", () => {
    expect(formatLabelField("型番", " HL2-6-JBS ")).toBe("型番: HL2-6-JBS");
  });

  it("does not render a label for an empty value", () => {
    expect(formatLabelField("サイズ", "   ")).toBe("");
  });
});
