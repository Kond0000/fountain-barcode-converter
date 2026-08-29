import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WorkHistoryDialog } from "./WorkHistoryDialog";

describe("WorkHistoryDialog", () => {
  it("offers deleting all stored histories when entries exist", () => {
    const html = renderToStaticMarkup(
      <WorkHistoryDialog
        open
        loading={false}
        histories={[{
          id: "history-1",
          savedAt: Date.UTC(2026, 7, 29),
          csvFileName: "items.csv",
          pdfTitle: "秋冬商品一覧",
          rowCount: 3,
          selectedCount: 2,
          imageCount: 1,
          imageBytes: 1024,
        }]}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onDeleteAll={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    expect(html).toContain("すべての履歴を削除");
    expect(html).toContain("保存されたCSV情報・設定・商品画像");
  });
});
