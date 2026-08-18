import { describe, expect, it } from "vitest";
import { createProductColumns } from "./ProductGrid";

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
