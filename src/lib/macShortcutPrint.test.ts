import { describe, expect, it, vi } from "vitest";
import {
  createMacPrintArchiveName,
  createMacPrintAppUrl,
  createMacPrintBundle,
  createMacPrintPageFileName,
  createMacShortcutUrl,
  isMacPrintApp,
  isMacOs,
  MAC_PRINT_SHORTCUT_NAME,
  prepareMacPrintJob,
  startPreparedMacPrintBundleDownload,
  waitForMacPrintJobCompletion,
  type NativePrintJobBridge,
} from "./macShortcutPrint";

const JOB_ID = "18c4f6b0-1234-4abc-8def-1234567890ab";

function createVariableHeightBundle() {
  return createMacPrintBundle({
    jobId: JOB_ID,
    pages: [
      { bytes: new Uint8Array([1, 2, 3]), widthMm: 60, heightMm: 47.583 },
      { bytes: new Uint8Array([4, 5, 6]), widthMm: 60, heightMm: 66.72 },
    ],
  });
}

describe("Mac Shortcut print job", () => {
  it("encodes the shortcut name and compact job JSON", () => {
    const bundle = createVariableHeightBundle();
    const url = createMacShortcutUrl(MAC_PRINT_SHORTCUT_NAME, bundle.job);
    expect(url).toContain("name=mC-Label3%20Print");
    expect(url).toContain("input=text");
    expect(JSON.parse(decodeURIComponent(url.split("&text=")[1]))).toEqual(bundle.job);
    expect(url).not.toContain("47.583");
  });

  it("keeps Japanese shortcut names URL-safe", () => {
    const url = createMacShortcutUrl("ラベル 印刷", createVariableHeightBundle().job);
    expect(url).toContain(encodeURIComponent("ラベル 印刷"));
  });

  it("encodes the print job for the Mac print app", () => {
    const bundle = createVariableHeightBundle();
    const url = createMacPrintAppUrl(bundle.job);
    expect(url.startsWith("fountain-label-print://print?job=")).toBe(true);
    expect(JSON.parse(decodeURIComponent(url.split("?job=")[1]))).toEqual(bundle.job);
  });

  it("creates an archive and numbered one-page PDF names", () => {
    expect(createMacPrintArchiveName(JOB_ID)).toBe(`mclabel-${JOB_ID}.zip`);
    expect(createMacPrintPageFileName(JOB_ID, 1, 60, 47.583)).toBe(
      `mclabel-${JOB_ID}-p000001-60x47.583mm.pdf`,
    );
  });

  it("records different dimensions for every page", () => {
    const bundle = createVariableHeightBundle();
    expect(bundle.job).toEqual({
      version: 2,
      jobId: JOB_ID,
      archiveName: `mclabel-${JOB_ID}.zip`,
      pageCount: 2,
    });
    expect(bundle.manifest.pages.map(({ widthMm, heightMm }) => [widthMm, heightMm])).toEqual([
      ["60", "47.583"],
      ["60", "66.72"],
    ]);
    expect(new DataView(bundle.bytes.buffer, bundle.bytes.byteOffset).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(bundle.bytes)).toContain("manifest.json");
  });

  it("uses OS detection only to distinguish Mac UI", () => {
    expect(isMacOs({ platform: "MacIntel", userAgent: "Macintosh", maxTouchPoints: 0 })).toBe(true);
    expect(isMacOs({ platform: "Win32", userAgent: "Windows", maxTouchPoints: 0 })).toBe(false);
    expect(isMacOs({ platform: "MacIntel", userAgent: "iPad", maxTouchPoints: 5 })).toBe(false);
  });

  it("detects the bundled macOS app from its user agent", () => {
    expect(isMacPrintApp({ platform: "MacIntel", userAgent: "Safari LABELPRINT-MAC/1.0", maxTouchPoints: 0 })).toBe(true);
    expect(isMacPrintApp({ platform: "MacIntel", userAgent: "Safari", maxTouchPoints: 0 })).toBe(false);
  });

  it("registers the print job with the Mac app before the ZIP download starts", async () => {
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockResolvedValue({ accepted: true }),
    };
    const job = createVariableHeightBundle().job;

    await expect(prepareMacPrintJob(job, bridge)).resolves.toBeUndefined();
    expect(bridge.postMessage).toHaveBeenCalledWith({ action: "prepare", job });
  });

  it("stops when the Mac app does not confirm the print job", async () => {
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockResolvedValue({ accepted: false }),
    };

    await expect(prepareMacPrintJob(createVariableHeightBundle().job, bridge)).rejects.toThrow("保存準備");
  });

  it("keeps waiting after the ZIP download until the Mac app reports completion", async () => {
    const order: string[] = [];
    let statusChecks = 0;
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockImplementation(async (message) => {
        order.push(message.action);
        if (message.action === "prepare") return { accepted: true };
        statusChecks += 1;
        return {
          jobId: JOB_ID,
          status: statusChecks === 1 ? "printing" : "completed",
          message: statusChecks === 1 ? "プリンターへ送信中です。" : "印刷ジョブを送信しました。",
        };
      }),
    };
    const download = vi.fn(() => order.push("download"));
    const sleep = vi.fn(async () => { order.push("wait"); });

    const result = await startPreparedMacPrintBundleDownload(
      createVariableHeightBundle(),
      bridge,
      download,
      { sleep },
    );

    expect(order).toEqual(["prepare", "download", "status", "wait", "status"]);
    expect(result.status).toBe("completed");
  });

  it("does not download the ZIP when the Mac app rejects the print job", async () => {
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockResolvedValue({ accepted: false }),
    };
    const download = vi.fn();

    await expect(startPreparedMacPrintBundleDownload(createVariableHeightBundle(), bridge, download)).rejects.toThrow();
    expect(download).not.toHaveBeenCalled();
  });

  it("rejects when the Mac app reports a print failure", async () => {
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockResolvedValue({
        jobId: JOB_ID,
        status: "failed",
        message: "プリンターへ送信できませんでした。",
      }),
    };

    await expect(waitForMacPrintJobCompletion(JOB_ID, bridge)).rejects.toThrow("送信できません");
  });

  it("stops waiting when the native completion notification times out", async () => {
    const bridge: NativePrintJobBridge = {
      postMessage: vi.fn().mockResolvedValue({
        jobId: JOB_ID,
        status: "printing",
        message: "プリンターへ送信中です。",
      }),
    };

    await expect(waitForMacPrintJobCompletion(JOB_ID, bridge, { timeoutMs: 0 })).rejects.toThrow("完了の通知");
  });
});
