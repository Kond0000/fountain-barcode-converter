export const LABEL_FONT_FAMILY = '"Hiragino Sans", "Yu Gothic", "Noto Sans JP", sans-serif';

export type AutoFitTextResult = {
  text: string;
  fontSize: number;
  lineHeight: number;
  shouldWrap: boolean;
};

type AutoFitTextOptions = {
  text: string;
  maxWidth: number;
  preferredFontSize: number;
  preferredLineHeight: number;
  minFontSize: number;
  measureAtPreferredSize: (value: string) => number;
};

export function normalizeSingleLineText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function fitTextToSingleLine({
  text,
  maxWidth,
  preferredFontSize,
  preferredLineHeight,
  minFontSize,
  measureAtPreferredSize,
}: AutoFitTextOptions): AutoFitTextResult {
  const normalized = normalizeSingleLineText(text);
  const safePreferredSize = Math.max(preferredFontSize, 1);
  const safeMinimumSize = Math.min(Math.max(minFontSize, 1), safePreferredSize);
  const safeLineHeight = Math.max(preferredLineHeight, safePreferredSize);
  const measuredWidth = normalized ? measureAtPreferredSize(normalized) : 0;
  const availableWidth = Math.max(maxWidth, 0);

  if (!Number.isFinite(measuredWidth) || measuredWidth <= availableWidth || measuredWidth <= 0) {
    return {
      text: normalized,
      fontSize: safePreferredSize,
      lineHeight: safeLineHeight,
      shouldWrap: false,
    };
  }

  const fittedSize = Math.floor((safePreferredSize * availableWidth / measuredWidth) * 100) / 100;
  const shouldWrap = fittedSize < safeMinimumSize;
  const fontSize = shouldWrap ? safeMinimumSize : fittedSize;

  return {
    text: normalized,
    fontSize,
    lineHeight: safeLineHeight * fontSize / safePreferredSize,
    shouldWrap,
  };
}
