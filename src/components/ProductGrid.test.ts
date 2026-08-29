import { describe, expect, it } from "vitest";
import {
  createProductColumns,
  createProductGridTemplate,
  getMatchingPdfImageIndices,
  getProductPage,
  PRODUCT_GRID_PAGE_SIZE,
} from "./ProductGrid";

describe("product grid columns", () => {
  it("shows the item-number and brand columns when their fields are mapped", () => {
    const columns = createProductColumns({
      barcode: "商品コード",
      productNumber: "グループコード",
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
      label: "品番",
      field: "グループコード",
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
    expect(template).toBe("38px minmax(max-content, 1.1fr) minmax(max-content, 1.8fr) minmax(max-content, 1fr) max-content 112px 72px");
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
