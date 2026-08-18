import { describe, expect, it } from "vitest";
import { layoutProductName } from "./layoutProductName";

describe("product name layout", () => {
  const layout = (text: string, maxWidth = 28) => layoutProductName({
    text,
    maxCharacters: 28,
    maxWidth,
    preferredFontSize: 10,
    preferredLineHeight: 12,
    minFontSize: 7.5,
    measure: (value, fontSize) => Array.from(value).length * fontSize / 10,
  });

  it("keeps a short product name on one line at the preferred size", () => {
    expect(layout("Short product")).toEqual({
      lines: ["Short product"],
      fontSize: 10,
      lineHeight: 12,
    });
  });

  it("wraps after the maximum character count at a nearby word boundary", () => {
    const result = layout("Loose joints JASON FOX GRRRR baseball cap", 40);
    expect(result.lines).toEqual(["Loose joints JASON FOX", "GRRRR baseball cap"]);
    expect(result.lines.every((line) => Array.from(line).length <= 28)).toBe(true);
  });

  it("shrinks to the minimum size and adds lines when physical width is still limited", () => {
    const result = layout("とても長い日本語の商品名です", 8);
    expect(result.fontSize).toBe(7.5);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines.every((line) => Array.from(line).length <= 10)).toBe(true);
  });
});
