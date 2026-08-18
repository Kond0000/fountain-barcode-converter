import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProductGridRow } from "./ProductGridRow";

const baseProps = {
  row: { 商品コード: "ABC123", 商品名: "Preview sample" },
  index: 0,
  state: { selected: true, copies: 1 },
  columns: [
    { key: "barcode", label: "バーコード", field: "商品コード" },
    { key: "productName", label: "商品名", field: "商品名" },
  ],
  template: "38px 1fr 1fr 84px",
  onActivate: vi.fn(),
  onSelectedChange: vi.fn(),
  onCopiesChange: vi.fn(),
};

describe("ProductGridRow", () => {
  it("marks the row that is currently shown in the preview", () => {
    const html = renderToStaticMarkup(<ProductGridRow {...baseProps} active />);

    expect(html).toContain("is-active");
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("この商品をプレビュー中");
    expect(html).toContain("プレビュー中");
  });

  it("invites inactive rows to be previewed without marking them current", () => {
    const html = renderToStaticMarkup(<ProductGridRow {...baseProps} active={false} />);

    expect(html).not.toContain("is-active");
    expect(html).not.toContain("aria-current");
    expect(html).toContain("クリックしてプレビュー");
  });
});
