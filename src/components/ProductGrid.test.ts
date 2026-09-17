import { describe, expect, it } from "vitest";
import {
  createProductColumns,
  createProductGridTemplate,
  getMatchingPdfImageIndices,
  getNextProductSort,
  getProductPage,
  PRODUCT_GRID_PAGE_SIZE,
  sortProductRows,
} from "./ProductGrid";
import { searchRows } from "../lib/csv/searchRows";
import type { CsvRow } from "../types/csv";

describe("product grid sorting", () => {
  const columns = createProductColumns({
    barcode: "商品コード",
    productNumber: "型番",
    productName: "商品名",
    brand: "ブランド",
    color: "カラー",
    size: "サイズ",
    price: "価格",
  });
  const indexRows = (rows: CsvRow[]) => rows.map((row, index) => ({ row, index }));

  it("starts each column in ascending order and toggles it with each click", () => {
    expect(getNextProductSort(undefined, "barcode")).toEqual({ key: "barcode", direction: "ascending" });
    expect(getNextProductSort({ key: "barcode", direction: "ascending" }, "barcode"))
      .toEqual({ key: "barcode", direction: "descending" });
    expect(getNextProductSort({ key: "barcode", direction: "descending" }, "barcode"))
      .toEqual({ key: "barcode", direction: "ascending" });
    expect(getNextProductSort({ key: "barcode", direction: "ascending" }, "price"))
      .toEqual({ key: "price", direction: "ascending" });
  });

  it.each(columns.filter(({ kind }) => kind !== "price"))("sorts $label naturally in both directions", (column) => {
    const rows = indexRows([
      { [column.field]: "ITEM-10" },
      { [column.field]: "ITEM-2" },
      { [column.field]: "ITEM-1" },
    ]);
    expect(sortProductRows(rows, { key: column.key, direction: "ascending" }, columns, []).map(({ index }) => index))
      .toEqual([2, 1, 0]);
    expect(sortProductRows(rows, { key: column.key, direction: "descending" }, columns, []).map(({ index }) => index))
      .toEqual([0, 1, 2]);
  });

  it("compares currency-formatted prices as numbers and keeps missing or invalid prices last", () => {
    const rows = indexRows([
      { 価格: "¥10,000" },
      { 価格: "９００" },
      { 価格: "￥２，０００" },
      { 価格: "1,200円" },
      { 価格: "" },
      { 価格: "価格未定" },
      { 価格: "0" },
      { 価格: "-100.5" },
    ]);
    expect(sortProductRows(rows, { key: "price", direction: "ascending" }, columns, []).map(({ index }) => index))
      .toEqual([7, 6, 1, 3, 2, 0, 5, 4]);
    expect(sortProductRows(rows, { key: "price", direction: "descending" }, columns, []).map(({ index }) => index))
      .toEqual([0, 2, 3, 1, 6, 7, 5, 4]);
  });

  it("normalizes full-width text and keeps equal values in CSV order without modifying the source", () => {
    const rows = indexRows([
      { 商品コード: " item-2 " },
      { 商品コード: "ＩＴＥＭ－２" },
      { 商品コード: "ITEM-10" },
      { 商品コード: " " },
      {},
    ]);
    expect(sortProductRows(rows, { key: "barcode", direction: "ascending" }, columns, []).map(({ index }) => index))
      .toEqual([0, 1, 2, 3, 4]);
    expect(sortProductRows(rows, { key: "barcode", direction: "descending" }, columns, []).map(({ index }) => index))
      .toEqual([2, 0, 1, 3, 4]);
    expect(rows.map(({ index }) => index)).toEqual([0, 1, 2, 3, 4]);
  });

  it("uses original row indices for copy counts after searching and sorting", () => {
    const rows = searchRows([
      { 商品コード: "OTHER" },
      { 商品コード: "ITEM-10" },
      { 商品コード: "ITEM-2" },
      { 商品コード: "ITEM-1" },
    ], "ITEM");
    const states = [1, 10, 2, 2].map((copies) => ({ selected: true, copies }));
    expect(sortProductRows(rows, { key: "copies", direction: "ascending" }, columns, states).map(({ index }) => index))
      .toEqual([2, 3, 1]);
    expect(sortProductRows(rows, { key: "copies", direction: "descending" }, columns, states).map(({ index }) => index))
      .toEqual([1, 2, 3]);
    expect(states.map(({ copies }) => copies)).toEqual([1, 10, 2, 2]);
  });

  it("sorts all matching rows before pagination and retains their original row references", () => {
    const rows = indexRows(Array.from({ length: 205 }, (_, index) => ({ 商品コード: `ITEM-${205 - index}` })));
    const sorted = sortProductRows(rows, { key: "barcode", direction: "ascending" }, columns, []);
    expect(getProductPage(sorted, 1)[0]).toBe(rows[204]);
    expect(getProductPage(sorted, 2)[0]).toBe(rows[104]);
    expect(getProductPage(sorted, 3).map(({ index }) => index)).toEqual([4, 3, 2, 1, 0]);
  });

  it("preserves CSV order until a displayed column is selected", () => {
    const rows = indexRows([{ 商品コード: "ITEM-2" }, { 商品コード: "ITEM-1" }]);
    expect(sortProductRows(rows, undefined, columns, [])).toBe(rows);
    expect(sortProductRows(rows, { key: "brand", direction: "ascending" }, [], [])).toBe(rows);
  });
});

describe("product grid columns", () => {
  it("shows the model number and brand columns when their fields are mapped", () => {
    const columns = createProductColumns({
      barcode: "商品コード",
      productNumber: "型番",
      productName: "商品名",
      brand: "ブランド名",
      color: "カラー",
      size: "サイズ",
      price: "販売価格",
    });

    expect(columns.map(({ key }) => key)).toEqual([
      "barcode",
      "productNumber",
      "productName",
      "brand",
      "color",
      "size",
      "price",
    ]);
    expect(columns.find(({ key }) => key === "productNumber")).toMatchObject({
      label: "型番",
      field: "型番",
    });
    expect(columns.find(({ key }) => key === "brand")).toMatchObject({
      label: "ブランド",
      field: "ブランド名",
    });
  });

  it("does not add an empty brand column when brand is unused", () => {
    expect(createProductColumns({ barcode: "商品コード" }).map(({ key }) => key)).toEqual(["barcode"]);
  });

  it("fills available width while preserving content-sized minimums", () => {
    const columns = createProductColumns({
      barcode: "商品コード",
      productName: "商品名",
      color: "カラー",
      size: "サイズ",
    });
    const template = createProductGridTemplate(columns);
    expect(template).toBe("38px 112px minmax(max-content, 1.1fr) minmax(max-content, 1.8fr) minmax(max-content, 1fr) max-content 72px");
  });
});

describe("product grid pagination", () => {
  const indexedRows = Array.from({ length: 205 }, (_, index) => ({
    index,
    row: { 商品コード: `ITEM-${index + 1}` },
  }));

  it("shows 100 products per page by default", () => {
    expect(PRODUCT_GRID_PAGE_SIZE).toBe(100);
    expect(getProductPage(indexedRows, 1)).toHaveLength(100);
    expect(getProductPage(indexedRows, 1).map(({ index }) => index)).toEqual(
      Array.from({ length: 100 }, (_, index) => index),
    );
  });

  it("returns only the indices on the current page for bulk selection", () => {
    expect(getProductPage(indexedRows, 2).map(({ index }) => index)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 100),
    );
    expect(getProductPage(indexedRows, 3).map(({ index }) => index)).toEqual([200, 201, 202, 203, 204]);
  });
});

describe("product grid PDF images", () => {
  const rows = [
    { 商品コード: "NIM-NIMHP01-WHT-M", 商品名: "HELP??Tシャツ", サイズ: "M" },
    { 商品コード: "NIM-NIMHP01-WHT-L", 商品名: "別の商品名でも対象", サイズ: "L" },
    { 商品コード: "NIM-NIMHP01-WHT-XL", 商品名: "HELP??Tシャツ", サイズ: "XL" },
    { 商品コード: "NIM-NIMHP01-BLK-M", 商品名: "HELP??Tシャツ", サイズ: "M" },
    { 商品コード: "", 商品名: "HELP??Tシャツ", サイズ: "M" },
    { 商品コード: "NIM-NIMHP01-WHT", 商品名: "HELP??Tシャツ", サイズ: "S" },
  ];

  it("finds size variants whose product code matches through the color segment", () => {
    expect(getMatchingPdfImageIndices(rows, { barcode: "商品コード", size: "サイズ" }, 0)).toEqual([0, 1, 2]);
  });

  it("keeps a different color in a separate image group", () => {
    expect(getMatchingPdfImageIndices(rows, { barcode: "商品コード", size: "サイズ" }, 3)).toEqual([3]);
  });

  it("updates only the source row when its product code is empty", () => {
    expect(getMatchingPdfImageIndices(rows, { barcode: "商品コード", size: "サイズ" }, 4)).toEqual([4]);
  });

  it("updates only the source row when no barcode field is mapped", () => {
    expect(getMatchingPdfImageIndices(rows, { size: "サイズ" }, 1)).toEqual([1]);
  });

  it("shares an image across rows with the same product number and color", () => {
    const registeredRows = [
      { 商品コード: "SYU-00001", グループコード: "27SSTP001A", カラー: "WHITE/PINK/BLACK BORDER", サイズ: "1" },
      { 商品コード: "SYU-00002", グループコード: "27SSTP001A", カラー: "WHITE/PINK/BLACK BORDER", サイズ: "2" },
      { 商品コード: "SYU-00003", グループコード: "27SSTP001A", カラー: "WHITE/PINK/BLACK BORDER", サイズ: "3" },
      { 商品コード: "SYU-00004", グループコード: "27SSTP001A", カラー: "BLACK/PINK", サイズ: "1" },
      { 商品コード: "SYU-00005", グループコード: "27SSTP001B", カラー: "WHITE/PINK/BLACK BORDER", サイズ: "1" },
    ];

    expect(getMatchingPdfImageIndices(registeredRows, {
      barcode: "商品コード",
      productNumber: "グループコード",
      color: "カラー",
      size: "サイズ",
    }, 0)).toEqual([0, 1, 2]);
  });

});
