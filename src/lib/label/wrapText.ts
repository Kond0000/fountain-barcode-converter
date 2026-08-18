export function wrapTextLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  return normalized.split(/\r?\n/).flatMap((paragraph) => {
    if (!paragraph) return [""];
    const lines: string[] = [];
    let current = "";
    for (const character of Array.from(paragraph)) {
      const candidate = current + character;
      if (current && measure(candidate) > maxWidth) {
        lines.push(current.trimEnd());
        current = character.trimStart();
      } else {
        current = candidate;
      }
    }
    if (current || lines.length === 0) lines.push(current.trimEnd());
    return lines;
  });
}

export function wrapTextByConstraints(
  text: string,
  maxCharacters: number,
  maxWidth: number,
  measure: (value: string) => number,
): string[] {
  const safeCharacterLimit = Math.max(Math.floor(maxCharacters), 1);
  const safeWidth = Math.max(maxWidth, 0);

  return text
    .trim()
    .split(/\r?\n/)
    .flatMap((paragraph) => {
      const lines: string[] = [];
      let remaining = paragraph.trim();

      while (remaining) {
        const characters = Array.from(remaining);
        let fittingCount = 0;
        let whitespaceBreak = 0;
        const candidateLimit = Math.min(characters.length, safeCharacterLimit);

        for (let index = 0; index < candidateLimit; index += 1) {
          const candidate = characters.slice(0, index + 1).join("");
          if (index > 0 && measure(candidate) > safeWidth) break;
          fittingCount = index + 1;
          if (/\s/u.test(characters[index])) whitespaceBreak = index + 1;
        }

        if (fittingCount >= characters.length) {
          lines.push(remaining);
          break;
        }

        const forcedBreak = Math.max(fittingCount, 1);
        const minimumWordBreak = Math.max(Math.floor(forcedBreak * 0.5), 1);
        const breakAt = whitespaceBreak >= minimumWordBreak ? whitespaceBreak : forcedBreak;
        lines.push(characters.slice(0, breakAt).join("").trimEnd());
        remaining = characters.slice(breakAt).join("").trimStart();
      }

      return lines.length > 0 ? lines : [""];
    });
}

export function wrapTextByCharacterLimit(text: string, maxCharacters: number): string[] {
  return wrapTextByConstraints(text, maxCharacters, Number.POSITIVE_INFINITY, (value) => Array.from(value).length);
}
