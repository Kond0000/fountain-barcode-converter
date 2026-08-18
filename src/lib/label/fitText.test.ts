import { describe, expect, it } from "vitest";
import { fitTextToSingleLine, normalizeSingleLineText } from "./fitText";

describe("fitTextToSingleLine", () => {
  const fit = (measuredWidth: number, maxWidth = 100) => fitTextToSingleLine({
    text: "Long product name",
    maxWidth,
    preferredFontSize: 10,
    preferredLineHeight: 12,
    minFontSize: 6,
    measureAtPreferredSize: () => measuredWidth,
  });

  it("keeps the preferred size when the text already fits", () => {
    expect(fit(90)).toMatchObject({ fontSize: 10, lineHeight: 12, shouldWrap: false });
  });

  it("shrinks the font enough to keep a long name on one line", () => {
    expect(fit(150)).toMatchObject({ fontSize: 6.66, shouldWrap: false });
  });

  it("uses the minimum size and allows wrapping only when one line is unreadable", () => {
    expect(fit(250)).toMatchObject({ fontSize: 6, lineHeight: 7.2, shouldWrap: true });
  });

  it("normalizes line breaks and repeated spaces for a single-line label", () => {
    expect(normalizeSingleLineText("  LONG\n  PRODUCT   NAME ")).toBe("LONG PRODUCT NAME");
  });
});
