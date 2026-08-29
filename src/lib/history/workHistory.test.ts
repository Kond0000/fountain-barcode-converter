import { describe, expect, it } from "vitest";
import {
  WORK_HISTORY_MAX_ENTRIES,
  createWorkHistoryRecord,
  getHistoryIdsToDelete,
  restoreWorkHistoryPayload,
  type WorkHistorySummary,
} from "./workHistory";

const baseState = {
  csvData: {
    fileName: "items.csv",
    encoding: "UTF-8" as const,
    headers: ["商品コード", "商品名"],
    rows: [
      { 商品コード: "A-1", 商品名: "Jacket" },
      { 商品コード: "A-2", 商品名: "Jacket" },
    ],
    warnings: [],
  },
  mapping: { barcode: "商品コード", productName: "商品名" },
  settings: { widthMm: 58, marginMm: 3 },
  pdfTitle: "秋冬商品一覧",
};

describe("work history", () => {
  it("deduplicates a shared image and restores all work state", () => {
    const image = new File([new Uint8Array([1, 2, 3])], "jacket.png", { type: "image/png" });
    const record = createWorkHistoryRecord({
      ...baseState,
      rowStates: [
        { selected: true, copies: 2, pdfImage: image },
        { selected: false, copies: 1, pdfImage: image },
      ],
    }, 123, "history-1");

    expect(record.summary).toMatchObject({
      id: "history-1",
      savedAt: 123,
      selectedCount: 1,
      imageCount: 1,
      imageBytes: 3,
    });
    expect(record.payload.images).toHaveLength(1);

    const restored = restoreWorkHistoryPayload(record.payload);
    expect(restored.pdfTitle).toBe("秋冬商品一覧");
    expect(restored.rowStates[0]).toMatchObject({ selected: true, copies: 2 });
    expect(restored.rowStates[0].pdfImage).toBe(restored.rowStates[1].pdfImage);
    expect(restored.rowStates[0].pdfImage?.name).toBe("jacket.png");
  });

  it("removes histories older than 90 days and caps the newest list", () => {
    const now = Date.UTC(2026, 7, 29);
    const day = 24 * 60 * 60 * 1_000;
    const summaries: WorkHistorySummary[] = Array.from(
      { length: WORK_HISTORY_MAX_ENTRIES + 2 },
      (_, index) => ({
        id: `history-${index}`,
        savedAt: now - index * day,
        csvFileName: "items.csv",
        pdfTitle: "商品一覧",
        rowCount: 1,
        selectedCount: 1,
        imageCount: 0,
        imageBytes: 0,
      }),
    );
    summaries.push({
      ...summaries[0],
      id: "expired",
      savedAt: now - 91 * day,
    });

    const deleted = getHistoryIdsToDelete(summaries, now);
    expect(deleted).toContain("expired");
    expect(deleted).toContain(`history-${WORK_HISTORY_MAX_ENTRIES}`);
    expect(deleted).not.toContain("history-0");
  });
});
