import { describe, expect, it } from "vitest";
import { getBarcodeTableEntries } from "../pdf/generateBarcodeTable";
import { createSelectedProductEntries } from "./productRows";

describe("selected products for PDF generation", () => {
  const rows = [
    { code: "ITEM-10", price: "¥10,000" },
    { code: "ITEM-2", price: "￥９００" },
    { code: "ITEM-1", price: "2,000円" },
  ];
  const mapping = { barcode: "code", price: "price" };

  it("matches the grid's natural ordering in both PDF directions", () => {
    const states = rows.map(() => ({ selected: true, copies: 1 }));
    const ascending = createSelectedProductEntries(rows, states, mapping, { key: "barcode", direction: "ascending" });
    const descending = createSelectedProductEntries(rows, states, mapping, { key: "barcode", direction: "descending" });
    expect(getBarcodeTableEntries(ascending).map(({ row }) => row.code)).toEqual(["ITEM-1", "ITEM-2", "ITEM-10"]);
    expect(getBarcodeTableEntries(descending).map(({ row }) => row.code)).toEqual(["ITEM-10", "ITEM-2", "ITEM-1"]);
  });

  it("keeps each product's copy count and image with it and omits unselected products", () => {
    const image = new File([new Uint8Array([1])], "item.png", { type: "image/png" });
    const states = [
      { selected: true, copies: 10, pdfImage: image },
      { selected: false, copies: 2 },
      { selected: true, copies: 1 },
    ];
    const entries = createSelectedProductEntries(rows, states, mapping, { key: "barcode", direction: "ascending" });
    expect(entries).toEqual([
      { row: rows[2], copies: 1, imageFile: undefined },
      { row: rows[0], copies: 10, imageFile: image },
    ]);
    expect(entries[1].row).toBe(rows[0]);
    expect(states[0]).toEqual({ selected: true, copies: 10, pdfImage: image });
    expect(rows.map(({ code }) => code)).toEqual(["ITEM-10", "ITEM-2", "ITEM-1"]);
  });

  it("applies numeric price and copy-count sorts to PDF products", () => {
    const states = [10, 2, 1].map((copies) => ({ selected: true, copies }));
    expect(createSelectedProductEntries(rows, states, mapping, { key: "price", direction: "ascending" }).map(({ row }) => row.code))
      .toEqual(["ITEM-2", "ITEM-1", "ITEM-10"]);
    expect(createSelectedProductEntries(rows, states, mapping, { key: "copies", direction: "descending" }).map(({ copies }) => copies))
      .toEqual([10, 2, 1]);
  });

  it("includes products beyond the visible grid page", () => {
    const manyRows = Array.from({ length: 205 }, (_, index) => ({ code: `ITEM-${205 - index}` }));
    const states = manyRows.map(() => ({ selected: true, copies: 1 }));
    const entries = createSelectedProductEntries(manyRows, states, mapping, { key: "barcode", direction: "ascending" });
    expect(entries).toHaveLength(205);
    expect(entries[0].row.code).toBe("ITEM-1");
    expect(entries[204].row.code).toBe("ITEM-205");
  });

  it("uses CSV order before sorting, including with an older restored history", () => {
    const states = rows.map(() => ({ selected: true, copies: 1 }));
    expect(createSelectedProductEntries(rows, states, mapping, undefined).map(({ row }) => row.code))
      .toEqual(["ITEM-10", "ITEM-2", "ITEM-1"]);
  });
});
