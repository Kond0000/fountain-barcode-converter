import { describe, expect, it } from "vitest";
import {
  calculateVariantCenterY,
  calculateVariantColorMaxWidth,
  calculateVariantSeparatorOffset,
  calculateVariantSizeTextX,
  fitVariantTextToSingleLine,
  formatVariantText,
  getVariantColumns,
  wrapVariantLines,
} from "./layoutVariant";

const measureCharacters = (value: string) => Array.from(value).length;

describe("variant text layout", () => {
  it("keeps short color and size text on one line", () => {
    const text = formatVariantText(["RED", "M"]);
    expect(wrapVariantLines(text, 100, measureCharacters)).toEqual(["RED / M"]);
  });

  it("wraps a long color at a slash before the size", () => {
    const text = formatVariantText(["WHITE/PINK/BLACK BORDER", "M"], "｜");
    expect(text).toBe("WHITE / PINK / BLACK BORDER｜M");
    expect(wrapVariantLines(text, 100, measureCharacters)).toEqual([
      "WHITE / PINK /",
      "BLACK BORDER｜M",
    ]);
  });

  it("uses underscores as a fallback break opportunity", () => {
    const text = formatVariantText(["BLACK/PURPLE_BLACK_BROWN", "L"], "｜");
    expect(wrapVariantLines(text, 100, measureCharacters)).toEqual([
      "BLACK / PURPLE",
      "BLACK_BROWN｜L",
    ]);
  });

  it("keeps the size separate from a wrapped color", () => {
    expect(getVariantColumns(["BLACK/PURPLE_BLACK_BROWN", "L"]))
      .toEqual({ color: "BLACK / PURPLE_BLACK_BROWN", size: "L" });
  });

  it("shrinks a long color to one line instead of wrapping it", () => {
    expect(fitVariantTextToSingleLine({
      text: "BLACK / PURPLE_BLACK_BROWN",
      maxWidth: 100,
      preferredFontSize: 10,
      preferredLineHeight: 12,
      measureAtPreferredSize: () => 160,
    })).toMatchObject({
      text: "BLACK / PURPLE_BLACK_BROWN",
      fontSize: 6.25,
      lineHeight: 7.5,
      shouldWrap: false,
    });
  });

  it("moves the separator with the rendered color width while preserving padding", () => {
    const maxColorWidth = calculateVariantColorMaxWidth(100, 20, 8, 4);
    expect(maxColorWidth).toBe(68);
    expect(calculateVariantSeparatorOffset(30, maxColorWidth, 8)).toBe(38);
    expect(calculateVariantSeparatorOffset(90, maxColorWidth, 8)).toBe(76);
  });

  it("uses the same gap on both sides of the separator", () => {
    const colorTextWidth = 30;
    const gap = 8;
    const separatorX = calculateVariantSeparatorOffset(colorTextWidth, 60, gap);
    const sizeTextX = calculateVariantSizeTextX(separatorX, gap);
    expect(separatorX - colorTextWidth).toBe(gap);
    expect(sizeTextX - separatorX).toBe(gap);
  });

  it("uses one vertical center for color and size text", () => {
    expect(calculateVariantCenterY(40, 12)).toBe(46);
    expect(calculateVariantCenterY(40, -12)).toBe(40);
  });
});
