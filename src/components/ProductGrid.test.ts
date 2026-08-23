import { describe, expect, it } from "vitest";
import {
  createProductColumns,
  getProductPage,
  PRODUCT_GRID_PAGE_SIZE,
} from "./ProductGrid";

describe("product grid columns", () => {
  it("shows the brand column when a brand field is mapped", () => {
    const columns = createProductColumns({
      barcode: "商品コード",
      productName: "商品名",
      brand: "ブランド名",
      color: "カラー",
      size: "サイズ",
      price: "販売価格",
    });

    expect(columns.map(({ key }) => key)).toEqual([
      "barcode",
      "productName",
      "brand",
      "color",
      "size",
      "price",
    ]);
    expect(columns.find(({ key }) => key === "brand")).toMatchObject({
      label: "ブランド",
      field: "ブランド名",
    });
  });

  it("does not add an empty brand column when brand is unused", () => {
    expect(createProductColumns({ barcode: "商品コード" }).map(({ key }) => key)).toEqual(["barcode"]);
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
