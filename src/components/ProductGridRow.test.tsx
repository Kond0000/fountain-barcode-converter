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
  template: "38px 1fr 1fr 118px 84px",
  onActivate: vi.fn(),
  onSelectedChange: vi.fn(),
  onCopiesChange: vi.fn(),
  onPdfImageChange: vi.fn(),
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

  it("offers an image picker dedicated to the table PDF", () => {
    const html = renderToStaticMarkup(<ProductGridRow {...baseProps} active={false} />);

    expect(html).toContain("画像を追加");
    expect(html).toContain("image/png,image/jpeg,image/webp");
    expect(html).toContain("ABC123の一覧PDF画像を選択");
  });

  it("marks the barcode cell as the fixed horizontal-scroll column", () => {
    const html = renderToStaticMarkup(<ProductGridRow {...baseProps} active={false} />);

    expect(html).toContain("product-column-barcode");
  });

  it("marks long color text as a wrapping table cell", () => {
    const html = renderToStaticMarkup(
      <ProductGridRow
        {...baseProps}
        active={false}
        row={{ ...baseProps.row, カラー: "WHITE/PINK/BLACK BORDER" }}
        columns={[
          ...baseProps.columns,
          { key: "color", label: "カラー", field: "カラー" },
        ]}
      />,
    );

    expect(html).toContain("product-color-cell");
    expect(html).toContain("WHITE/PINK/BLACK BORDER");
  });
});
