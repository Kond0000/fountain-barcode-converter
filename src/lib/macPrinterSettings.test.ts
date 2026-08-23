import { describe, expect, it, vi } from "vitest";
import {
  loadMacPrinterSettings,
  isMacPrinterDiagnosticReady,
  parseMacPrinterSettings,
  saveMacPrinterSelection,
  type MacPrinterDiagnostic,
  type NativePrinterSettingsBridge,
} from "./macPrinterSettings";

const READY_DIAGNOSTIC: MacPrinterDiagnostic = {
  status: "ready",
  code: "ready",
  printerName: "MCL32_B",
  summary: "印刷準備OK",
  detail: "アプリの直接印刷に必要な設定を確認できました。",
  checks: [
    { id: "queue", label: "プリンター登録", status: "pass", detail: "MCL32_B" },
  ],
  setupSteps: [],
};

describe("Mac printer settings bridge", () => {
  it("loads the registered queues and saved printer", async () => {
    const bridge: NativePrinterSettingsBridge = {
      postMessage: vi.fn().mockResolvedValue({
        printers: ["MCL32_A", "MCL32_B"],
        selectedPrinter: "MCL32_B",
        diagnostic: READY_DIAGNOSTIC,
      }),
    };

    await expect(loadMacPrinterSettings(bridge)).resolves.toEqual({
      printers: ["MCL32_A", "MCL32_B"],
      selectedPrinter: "MCL32_B",
      diagnostic: READY_DIAGNOSTIC,
    });
    expect(bridge.postMessage).toHaveBeenCalledWith({ action: "list" });
  });

  it("saves an explicit queue or clears the selection for automatic detection", async () => {
    const bridge: NativePrinterSettingsBridge = {
      postMessage: vi.fn().mockImplementation(async ({ printerName }) => ({
        printers: ["Shop_Label"],
        selectedPrinter: printerName ?? null,
        diagnostic: { ...READY_DIAGNOSTIC, printerName: printerName ?? "Shop_Label" },
      })),
    };

    await expect(saveMacPrinterSelection("Shop_Label", bridge)).resolves.toMatchObject({ selectedPrinter: "Shop_Label" });
    await expect(saveMacPrinterSelection(null, bridge)).resolves.toMatchObject({ selectedPrinter: null });
    expect(bridge.postMessage).toHaveBeenNthCalledWith(1, { action: "save", printerName: "Shop_Label" });
    expect(bridge.postMessage).toHaveBeenNthCalledWith(2, { action: "save", printerName: null });
  });

  it("rejects malformed native responses", () => {
    expect(() => parseMacPrinterSettings({
      printers: "MCL32",
      selectedPrinter: null,
      diagnostic: READY_DIAGNOSTIC,
    })).toThrow("プリンター一覧");
    expect(() => parseMacPrinterSettings({
      printers: [],
      selectedPrinter: 123,
      diagnostic: READY_DIAGNOSTIC,
    })).toThrow("保存済みプリンター");
    expect(() => parseMacPrinterSettings({
      printers: [],
      selectedPrinter: null,
      diagnostic: { ...READY_DIAGNOSTIC, checks: "invalid" },
    })).toThrow("プリンター診断項目");
  });

  it("allows ready and warning diagnostics only when a printer was resolved", () => {
    expect(isMacPrinterDiagnosticReady(READY_DIAGNOSTIC)).toBe(true);
    expect(isMacPrinterDiagnosticReady({ ...READY_DIAGNOSTIC, status: "warning" })).toBe(true);
    expect(isMacPrinterDiagnosticReady({ ...READY_DIAGNOSTIC, status: "error" })).toBe(false);
    expect(isMacPrinterDiagnosticReady({ ...READY_DIAGNOSTIC, printerName: null })).toBe(false);
  });
});
