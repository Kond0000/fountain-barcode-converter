import { describe, expect, it } from "vitest";
import {
  createMacPrintArchiveName,
  createMacPrintBundle,
  createMacPrintPageFileName,
  createMacShortcutUrl,
  isMacOs,
  MAC_PRINT_SHORTCUT_NAME,
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
});
