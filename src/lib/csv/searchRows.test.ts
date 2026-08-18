import { describe, expect, it } from "vitest";
import { searchRows } from "./searchRows";

describe("searchRows", () => {
  const rows = [
    { 商品コード: "ke0032brw", 商品名: "Strata", 仕入先: "東京商会" },
    { 商品コード: "AB-10", 商品名: "Coat", 仕入先: "Osaka" },
  ];
  it("searches every CSV field", () => {
    expect(searchRows(rows, "東京").map(({ index }) => index)).toEqual([0]);
    expect(searchRows(rows, "osaka").map(({ index }) => index)).toEqual([1]);
  });
});
