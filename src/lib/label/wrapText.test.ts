import { describe, expect, it } from "vitest";
import { wrapTextByCharacterLimit, wrapTextByConstraints, wrapTextLines } from "./wrapText";

describe("wrapTextLines", () => {
  const measure = (value: string) => Array.from(value).length;

  it("wraps long text without dropping characters", () => {
    expect(wrapTextLines("とても長い商品名です", 4, measure)).toEqual(["とても長", "い商品名", "です"]);
  });

  it("preserves explicit line breaks", () => {
    expect(wrapTextLines("first\nsecond", 20, measure)).toEqual(["first", "second"]);
  });

  it("limits each line and prefers breaking at spaces", () => {
    expect(wrapTextByCharacterLimit("Loose joints JASON FOX GRRRR", 18)).toEqual([
      "Loose joints",
      "JASON FOX GRRRR",
    ]);
  });

  it("combines a character limit with the measured physical width", () => {
    expect(wrapTextByConstraints("Long product title", 20, 8, measure)).toEqual([
      "Long",
      "product",
      "title",
    ]);
  });
});
