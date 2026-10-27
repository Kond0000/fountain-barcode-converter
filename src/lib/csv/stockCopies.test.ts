import { describe, expect, it } from "vitest";
import { calculateLabelPageCount } from "../pdf/generateLabels";
import { getBarcodeTableEntries } from "../pdf/generateBarcodeTable";
import { detectFields } from "./detectFields";
import { parseCsvText } from "./parseCsv";
import { createSelectedProductEntries } from "./productRows";
import { getStockCopies, normalizePrintCopies } from "./stockCopies";

describe("stock-based print copies", () => {
  it.each([
    ["5", 5], [" １２ ", 12], ["1,000", 999], ["１，０００", 999],
    ["0", 0], ["-3", 0], ["2.9", 2], ["0.5", 0], ["999", 999], ["1000", 999],
    [undefined, 1], ["", 1], ["  ", 1], ["不明", 1], ["3枚", 1],
    ["NaN", 1], ["Infinity", 1], ["1e3", 1], ["1,2", 1],
  ])("converts stock %s into %s label copies", (value, copies) => {
    expect(getStockCopies(value)).toBe(copies);
  });

  it("reflects stock in both PDF selections and the label page count", () => {
    const csv = parseCsvText("商品コード,在庫\nA,3\n,0\nC,2\nD,-1\nE,\nF,不明");
    const mapping = detectFields(csv.headers);
    const states = csv.rows.map((row) => ({ selected: true, copies: getStockCopies(row[mapping.stock!]) }));
    const entries = createSelectedProductEntries(csv.rows, states, mapping, undefined);

    expect(entries.map(({ row, copies }) => [row.商品コード, copies])).toEqual([
      ["A", 3], ["C", 2], ["E", 1], ["F", 1],
    ]);
    expect(calculateLabelPageCount(entries)).toBe(7);
    expect(getBarcodeTableEntries(entries)).toHaveLength(4);
  });

  it("keeps the one-copy default when there is no stock column", () => {
    const csv = parseCsvText("商品コード,商品名\nA,シャツ\nB,パンツ");
    const mapping = detectFields(csv.headers);
    expect(mapping.stock).toBeUndefined();
    expect(csv.rows.map((row) => getStockCopies(mapping.stock ? row[mapping.stock] : undefined))).toEqual([1, 1]);
  });

  it("allows a manually entered zero and handles invalid or out-of-range counts", () => {
    expect([0, -1, 3.9, 1000, NaN, Infinity].map(normalizePrintCopies)).toEqual([0, 0, 3, 999, 1, 1]);
  });
});
