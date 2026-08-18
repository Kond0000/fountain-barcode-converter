export type CsvRow = Record<string, string>;

export type CsvEncoding = "UTF-8" | "Shift_JIS";

export type CsvData = {
  fileName: string;
  encoding: CsvEncoding;
  headers: string[];
  rows: CsvRow[];
  warnings: string[];
};

export type RowState = {
  selected: boolean;
  copies: number;
};
