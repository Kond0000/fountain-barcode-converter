import Papa, { type ParseError } from "papaparse";
import type { CsvData, CsvEncoding, CsvRow } from "../../types/csv";

function cleanHeader(header: string, index: number): string {
  const cleaned = header.replace(/^\uFEFF/, "").trim();
  return cleaned || `列${index + 1}`;
}

function errorMessage(error: ParseError): string {
  const row = typeof error.row === "number" ? `${error.row + 1}行目: ` : "";
  return `${row}${error.message}`;
}

export function parseCsvText(
  text: string,
  fileName = "data.csv",
  encoding: CsvEncoding = "UTF-8",
): CsvData {
  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: cleanHeader,
  });

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) throw new Error("CSVヘッダーを読み取れませんでした。");

  const rows = result.data.map((row) =>
    Object.fromEntries(headers.map((header) => [header, String(row[header] ?? "")])),
  );
  if (rows.length === 0) throw new Error("CSVに商品データがありません。");

  return {
    fileName,
    encoding,
    headers,
    rows,
    warnings: result.errors.map(errorMessage),
  };
}

function decodeBuffer(buffer: ArrayBuffer): { text: string; encoding: CsvEncoding } {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
      encoding: "UTF-8",
    };
  } catch {
    return {
      text: new TextDecoder("shift_jis").decode(buffer),
      encoding: "Shift_JIS",
    };
  }
}

export async function parseCsvFile(file: File): Promise<CsvData> {
  const decoded = decodeBuffer(await file.arrayBuffer());
  return parseCsvText(decoded.text, file.name, decoded.encoding);
}
