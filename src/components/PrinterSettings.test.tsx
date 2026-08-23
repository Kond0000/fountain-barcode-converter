import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrinterSettingsPanel } from "./PrinterSettings";

describe("PrinterSettingsPanel", () => {
  it("groups the printer label, diagnostic status, controls, and saved state in a clear order", () => {
    const html = renderToStaticMarkup(<PrinterSettingsPanel />);

    expect(html).toContain('class="printer-settings-heading"');
    expect(html).toContain('class="printer-status-badge is-checking"');
    expect(html).toContain('class="printer-settings-controls"');
    expect(html).toContain('class="printer-settings-footer"');
    expect(html).toContain("印刷先プリンター");
    expect(html).toContain("プリンターを確認中");
    expect(html).toContain("再確認");
    expect(html).toContain("MCL32が1台の場合に自動選択");
    expect(html).toContain("診断詳細");
  });
});
