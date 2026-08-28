import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FieldMappingPanel } from "./FieldMapping";

describe("FieldMappingPanel", () => {
  it("renders the field mappings as app-styled accessible comboboxes", () => {
    const html = renderToStaticMarkup(
      <FieldMappingPanel
        headers={["商品コード", "品番", "商品名", "ブランド"]}
        mapping={{ barcode: "商品コード", productNumber: "品番", productName: "商品名", brand: "ブランド" }}
        onChange={vi.fn()}
      />,
    );

    expect(html.match(/role="combobox"/g)).toHaveLength(7);
    expect(html).not.toContain("<select");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(">商品コード</span>");
    expect(html).toContain(">品番</span>");
    expect(html).toContain(">ブランド</span>");
  });
});
