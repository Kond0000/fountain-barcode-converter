import { describe, expect, it } from "vitest";
import { createStoredZip } from "./createStoredZip";

describe("stored ZIP", () => {
  it("creates a ZIP containing all file names and an end record", () => {
    const zip = createStoredZip([
      { fileName: "manifest.json", bytes: new TextEncoder().encode("{}") },
      { fileName: "page.pdf", bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) },
    ]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("manifest.json");
    expect(text).toContain("page.pdf");
    expect(new DataView(zip.buffer, zip.byteOffset + zip.byteLength - 22, 4).getUint32(0, true)).toBe(0x06054b50);
  });

  it("rejects duplicate or path-like names", () => {
    expect(() => createStoredZip([
      { fileName: "same.pdf", bytes: new Uint8Array() },
      { fileName: "same.pdf", bytes: new Uint8Array() },
    ])).toThrow("重複");
    expect(() => createStoredZip([
      { fileName: "../page.pdf", bytes: new Uint8Array() },
    ])).toThrow("不正");
    expect(() => createStoredZip(Array.from({ length: 65_536 }, (_, index) => ({
      fileName: `${index}.pdf`,
      bytes: new Uint8Array(),
    })))).toThrow("上限");
  });
});
