export type MacPrinterSettings = {
  printers: string[];
  selectedPrinter: string | null;
  diagnostic: MacPrinterDiagnostic;
};

export type MacPrinterDiagnosticStatus = "ready" | "warning" | "error";
export type MacPrinterCheckStatus = "pass" | "warning" | "fail" | "pending";

export type MacPrinterDiagnosticCheck = {
  id: string;
  label: string;
  status: MacPrinterCheckStatus;
  detail: string;
};

export type MacPrinterDiagnostic = {
  status: MacPrinterDiagnosticStatus;
  code: string;
  printerName: string | null;
  summary: string;
  detail: string;
  checks: MacPrinterDiagnosticCheck[];
  setupSteps: string[];
};

export type MacPrinterReadiness = {
  canPrint: boolean;
  status: MacPrinterDiagnosticStatus | "checking" | "saving";
  summary: string;
  detail: string;
};

type NativePrinterSettingsMessage = {
  action: "list" | "save";
  printerName?: string | null;
};

export type NativePrinterSettingsBridge = {
  postMessage: (message: NativePrinterSettingsMessage) => Promise<unknown>;
};

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        printerSettings?: NativePrinterSettingsBridge;
        printJob?: import("./macShortcutPrint").NativePrintJobBridge;
      };
    };
  }
}

function getNativeBridge(): NativePrinterSettingsBridge {
  const bridge = typeof window === "undefined" ? undefined : window.webkit?.messageHandlers?.printerSettings;
  if (!bridge) throw new Error("Macアプリのプリンター設定機能を利用できません。");
  return bridge;
}

export function parseMacPrinterSettings(value: unknown): MacPrinterSettings {
  if (!value || typeof value !== "object") throw new Error("プリンター情報の形式が不正です。");
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.printers) || !record.printers.every((printer) => typeof printer === "string")) {
    throw new Error("プリンター一覧の形式が不正です。");
  }
  if (record.selectedPrinter !== null && typeof record.selectedPrinter !== "string") {
    throw new Error("保存済みプリンターの形式が不正です。");
  }
  const diagnostic = parseMacPrinterDiagnostic(record.diagnostic);
  return {
    printers: Array.from(new Set(record.printers)),
    selectedPrinter: record.selectedPrinter || null,
    diagnostic,
  };
}

function parseMacPrinterDiagnostic(value: unknown): MacPrinterDiagnostic {
  if (!value || typeof value !== "object") throw new Error("プリンター診断結果の形式が不正です。");
  const record = value as Record<string, unknown>;
  if (!(["ready", "warning", "error"] as const).includes(record.status as MacPrinterDiagnosticStatus)) {
    throw new Error("プリンター診断ステータスの形式が不正です。");
  }
  if (typeof record.code !== "string"
    || (record.printerName !== null && typeof record.printerName !== "string")
    || typeof record.summary !== "string"
    || typeof record.detail !== "string") {
    throw new Error("プリンター診断内容の形式が不正です。");
  }
  if (!Array.isArray(record.checks) || !record.checks.every(isMacPrinterDiagnosticCheck)) {
    throw new Error("プリンター診断項目の形式が不正です。");
  }
  if (!Array.isArray(record.setupSteps) || !record.setupSteps.every((step) => typeof step === "string")) {
    throw new Error("プリンターのセットアップ手順の形式が不正です。");
  }
  return {
    status: record.status as MacPrinterDiagnosticStatus,
    code: record.code,
    printerName: record.printerName as string | null,
    summary: record.summary,
    detail: record.detail,
    checks: record.checks,
    setupSteps: record.setupSteps,
  };
}

function isMacPrinterDiagnosticCheck(value: unknown): value is MacPrinterDiagnosticCheck {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.label === "string"
    && (["pass", "warning", "fail", "pending"] as const).includes(record.status as MacPrinterCheckStatus)
    && typeof record.detail === "string";
}

export async function loadMacPrinterSettings(
  bridge: NativePrinterSettingsBridge = getNativeBridge(),
): Promise<MacPrinterSettings> {
  return parseMacPrinterSettings(await bridge.postMessage({ action: "list" }));
}

export async function saveMacPrinterSelection(
  printerName: string | null,
  bridge: NativePrinterSettingsBridge = getNativeBridge(),
): Promise<MacPrinterSettings> {
  return parseMacPrinterSettings(await bridge.postMessage({ action: "save", printerName }));
}

export function isMacPrinterDiagnosticReady(diagnostic: MacPrinterDiagnostic): boolean {
  return Boolean(diagnostic.printerName)
    && (diagnostic.status === "ready" || diagnostic.status === "warning");
}
