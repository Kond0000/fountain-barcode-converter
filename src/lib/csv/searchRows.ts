import type { CsvRow } from "../../types/csv";

export type IndexedCsvRow = { index: number; row: CsvRow };

export function searchRows(rows: CsvRow[], query: string): IndexedCsvRow[] {
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase("ja");
  return rows.flatMap((row, index) => {
    if (!needle) return [{ row, index }];
    const matches = Object.values(row).some((value) =>
      value.normalize("NFKC").toLocaleLowerCase("ja").includes(needle),
    );
    return matches ? [{ row, index }] : [];
  });
}
