import { describe, expect, it } from "vitest";
import { detectFields } from "./detectFields";

describe("detectFields", () => {
  it("maps Japanese headers without depending on order", () => {
    expect(detectFields(["仕入先", "サイズ", "販売価格", "商品名", "商品コード", "カラー"])).toEqual({
      barcode: "商品コード",
      productName: "商品名",
      price: "販売価格",
      color: "カラー",
      size: "サイズ",
    });
  });

  it("matches English headers case-insensitively", () => {
    expect(detectFields(["sku", "TITLE", "price", "Colour", "size", "BRAND"])).toEqual({
      barcode: "sku",
      productName: "TITLE",
      price: "price",
      color: "Colour",
      size: "size",
      brand: "BRAND",
    });
  });
});
