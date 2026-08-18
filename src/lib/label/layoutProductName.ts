import { normalizeSingleLineText } from "./fitText";
import { wrapTextByCharacterLimit, wrapTextByConstraints } from "./wrapText";

export type ProductNameLayoutOptions = {
  text: string;
  maxCharacters: number;
  maxWidth: number;
  preferredFontSize: number;
  preferredLineHeight: number;
  minFontSize: number;
  measure: (value: string, fontSize: number) => number;
};

export type ProductNameLayout = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
};

export function layoutProductName({
  text,
  maxCharacters,
  maxWidth,
  preferredFontSize,
  preferredLineHeight,
  minFontSize,
  measure,
}: ProductNameLayoutOptions): ProductNameLayout {
  const normalized = normalizeSingleLineText(text);
  const safePreferredSize = Math.max(preferredFontSize, 1);
  const safeMinimumSize = Math.min(Math.max(minFontSize, 1), safePreferredSize);
  const safeLineHeight = Math.max(preferredLineHeight, safePreferredSize);
  const safeWidth = Math.max(maxWidth, 0);
  const characterLimitedLines = wrapTextByCharacterLimit(normalized, maxCharacters);
  const widestPreferredLine = characterLimitedLines.reduce(
    (widest, line) => Math.max(widest, measure(line, safePreferredSize)),
    0,
  );
  const scale = widestPreferredLine > safeWidth && widestPreferredLine > 0
    ? safeWidth / widestPreferredLine
    : 1;
  const fittedFontSize = Math.max(
    safeMinimumSize,
    Math.floor(safePreferredSize * Math.min(scale, 1) * 100) / 100,
  );
  const fittedLineHeight = safeLineHeight * fittedFontSize / safePreferredSize;
  const lines = wrapTextByConstraints(
    normalized,
    maxCharacters,
    safeWidth,
    (value) => measure(value, fittedFontSize),
  );

  return {
    lines,
    fontSize: fittedFontSize,
    lineHeight: fittedLineHeight,
  };
}
