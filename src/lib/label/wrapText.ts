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
