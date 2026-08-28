import { describe, expect, it } from "vitest";
import { detectFields } from "./detectFields";

describe("detectFields", () => {
  it("maps Japanese headers without depending on order", () => {
    expect(detectFields(["仕入先", "サイズ", "販売価格", "商品名", "商品コード", "グループコード", "カラー"])).toEqual({
      barcode: "商品コード",
      productNumber: "グループコード",
      productName: "商品名",
      price: "販売価格",
      color: "カラー",
      size: "サイズ",
    });
  });

  it("matches English headers case-insensitively", () => {
    expect(detectFields(["sku", "Style No", "TITLE", "price", "Colour", "size", "BRAND"])).toEqual({
      barcode: "sku",
      productNumber: "Style No",
      productName: "TITLE",
      price: "price",
      color: "Colour",
      size: "size",
      brand: "BRAND",
    });
  });

  it("maps ブランド名 or ブランド to brand and prefers ブランド名", () => {
    expect(detectFields(["商品コード", "ブランド名"])).toMatchObject({
      brand: "ブランド名",
    });
    expect(detectFields(["商品コード", "ブランド"])).toMatchObject({
      brand: "ブランド",
    });
    expect(detectFields(["商品コード", "ブランド", "ブランド名"])).toMatchObject({
      brand: "ブランド名",
    });
  });
});
