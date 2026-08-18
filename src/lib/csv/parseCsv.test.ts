import { describe, expect, it } from "vitest";
import { parseCsvText } from "./parseCsv";

describe("parseCsvText", () => {
  it("keeps unknown columns and string values intact", () => {
    const data = parseCsvText("商品コード,商品名,独自列\n00123,シャツ,秋冬", "products.csv");
    expect(data.headers).toEqual(["商品コード", "商品名", "独自列"]);
    expect(data.rows[0]).toEqual({ 商品コード: "00123", 商品名: "シャツ", 独自列: "秋冬" });
  });
});
