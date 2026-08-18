import { describe, expect, it } from "vitest";
import { createDefaultVisibleFields, createProductColumns, getMappedGridFields } from "./productColumns";

const headers = ["商品コード", "商品名", "カテゴリ", "商品単価", "仕入先"];
const mapping = { barcode: "商品コード", productName: "商品名", price: "商品単価" };

describe("product grid columns", () => {
  it("uses mapped label fields as the initial visible columns in CSV order", () => {
    expect(createDefaultVisibleFields(headers, mapping)).toEqual(["商品コード", "商品名", "商品単価"]);
  });

  it("falls back to the first five CSV columns when no fields are mapped", () => {
    expect(createDefaultVisibleFields([...headers, "在庫"], {})).toEqual(headers);
  });

  it("creates only selected columns and formats the mapped price field", () => {
    expect(createProductColumns(headers, mapping, new Set(["カテゴリ", "商品単価", "仕入先"]))).toEqual([
      { key: "カテゴリ", label: "カテゴリ", field: "カテゴリ", kind: undefined },
      { key: "商品単価", label: "商品単価", field: "商品単価", kind: "price" },
      { key: "仕入先", label: "仕入先", field: "仕入先", kind: undefined },
    ]);
  });

  it("deduplicates a CSV field mapped to more than one label role", () => {
    expect(getMappedGridFields({ barcode: "code", productName: "code" })).toEqual(["code"]);
    expect(createDefaultVisibleFields(["code"], { barcode: "code", productName: "code" })).toEqual(["code"]);
  });
});
