import {
  fitTextToSingleLine,
  normalizeSingleLineText,
  type AutoFitTextResult,
} from "./fitText";

export const VARIANT_MAX_CHARACTERS_PER_LINE = 20;
export const VARIANT_SEPARATOR_GAP_MM = 1.4;

function normalizeVariantPart(value: string): string {
  return normalizeSingleLineText(value.replace(/\s*\/\s*/g, " / "));
}

export function formatVariantText(parts: string[], separator = " / "): string {
  return parts
    .map(normalizeVariantPart)
    .filter(Boolean)
    .join(separator);
}

export function getVariantColumns(parts: string[]): { color: string; size: string } {
  return {
    color: formatVariantText(parts.slice(0, 1)),
    size: formatVariantText(parts.slice(1, 2)),
  };
}

export function fitVariantTextToSingleLine({
  text,
  maxWidth,
  preferredFontSize,
  preferredLineHeight,
  measureAtPreferredSize,
}: {
  text: string;
  maxWidth: number;
  preferredFontSize: number;
  preferredLineHeight: number;
  measureAtPreferredSize: (value: string) => number;
}): AutoFitTextResult {
  return fitTextToSingleLine({
    text,
    maxWidth,
    preferredFontSize,
    preferredLineHeight,
    minFontSize: 1,
    measureAtPreferredSize,
  });
}

export function calculateVariantColorMaxWidth(
  totalWidth: number,
  sizeWidth: number,
  separatorBeforeGap: number,
  separatorAfterGap: number,
): number {
  return Math.max(
    Math.max(totalWidth, 0)
    - Math.max(sizeWidth, 0)
    - Math.max(separatorBeforeGap, 0)
    - Math.max(separatorAfterGap, 0),
    1,
  );
}

export function calculateVariantSeparatorOffset(
  colorTextWidth: number,
  maxColorWidth: number,
  separatorBeforeGap: number,
): number {
  return Math.min(
    Math.max(colorTextWidth, 0),
    Math.max(maxColorWidth, 0),
  ) + Math.max(separatorBeforeGap, 0);
}

export function calculateVariantSizeTextX(
  separatorX: number,
  separatorAfterGap: number,
): number {
  return separatorX + Math.max(separatorAfterGap, 0);
}

export function calculateVariantCenterY(top: number, lineHeight: number): number {
  return top + Math.max(lineHeight, 0) / 2;
}

export function wrapVariantLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
  maxCharacters = VARIANT_MAX_CHARACTERS_PER_LINE,
): string[] {
  const normalized = normalizeVariantPart(text);
  if (!normalized) return [];

  const safeWidth = Math.max(maxWidth, 0);
  const safeCharacterLimit = Math.max(Math.floor(maxCharacters), 1);
  const lines: string[] = [];
  let remaining = normalized;

  while (remaining) {
    const characters = Array.from(remaining);
    const candidateLimit = Math.min(characters.length, safeCharacterLimit);
    let fittingCount = 0;
    let naturalBreak = 0;

    for (let index = 0; index < candidateLimit; index += 1) {
      const candidate = characters.slice(0, index + 1).join("");
      if (index > 0 && measure(candidate) > safeWidth) break;
      fittingCount = index + 1;
      if (/\s/u.test(characters[index]) || characters[index] === "/" || characters[index] === "_") {
        naturalBreak = index + 1;
      }
    }

    if (fittingCount >= characters.length) {
      lines.push(remaining);
      break;
    }

    const forcedBreak = Math.max(fittingCount, 1);
    const minimumNaturalBreak = Math.max(Math.floor(forcedBreak * 0.45), 1);
    const breakAt = naturalBreak >= minimumNaturalBreak ? naturalBreak : forcedBreak;
    lines.push(characters.slice(0, breakAt).join("").trim().replace(/_$/u, ""));
    remaining = characters.slice(breakAt).join("").trim();
  }

  return lines;
}
