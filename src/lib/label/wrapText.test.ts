import { describe, expect, it } from "vitest";
import { wrapTextLines } from "./wrapText";

describe("wrapTextLines", () => {
  const measure = (value: string) => Array.from(value).length;

  it("wraps long text without dropping characters", () => {
    expect(wrapTextLines("とても長い商品名です", 4, measure)).toEqual(["とても長", "い商品名", "です"]);
  });

  it("preserves explicit line breaks", () => {
    expect(wrapTextLines("first\nsecond", 20, measure)).toEqual(["first", "second"]);
  });
});
