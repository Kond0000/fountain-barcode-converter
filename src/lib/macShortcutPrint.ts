import { createStoredZip } from "./zip/createStoredZip";

export const MAC_PRINT_SHORTCUT_NAME = "mC-Label3 Print";
export const MAC_PRINT_APP_NAME = "LABEL PRINT";

export type MacPrintJob = {
  version: 2;
  jobId: string;
  archiveName: string;
  pageCount: number;
};

export type MacPrintPage = {
  fileName: string;
  widthMm: string;
  heightMm: string;
};

export type MacPrintManifest = {
  version: 2;
  jobId: string;
  pageCount: number;
  pages: MacPrintPage[];
};

type MacPrintBundleInput = {
  jobId?: string;
  pages: Array<{ bytes: Uint8Array; widthMm: number; heightMm: number }>;
};

export type MacPrintBundle = {
  bytes: Uint8Array;
  job: MacPrintJob;
  manifest: MacPrintManifest;
};

type NativePrintJobMessage =
  | { action: "prepare"; job: MacPrintJob }
  | { action: "status"; jobId: string };

export type NativePrintJobStatus = {
  jobId: string;
  status: "prepared" | "saving" | "printing" | "completed" | "failed";
  message: string;
};

export type NativePrintJobBridge = {
  postMessage: (message: NativePrintJobMessage) => Promise<unknown>;
};

type NativePrintWaitOptions = {
  pollIntervalMs?: number;
  timeoutMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

type PlatformNavigator = Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent">;

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        printerSettings?: import("./macPrinterSettings").NativePrinterSettingsBridge;
        printJob?: NativePrintJobBridge;
      };
    };
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatMacPrintDimension(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error("ラベルサイズが不正です。");
  return String(Math.round(value * 1000) / 1000);
}

function validateJobId(jobId: string): void {
  if (!UUID_PATTERN.test(jobId)) throw new Error("印刷ジョブIDが不正です。");
}

export function createMacPrintArchiveName(jobId: string): string {
  validateJobId(jobId);
  return `mclabel-${jobId}.zip`;
}

export function createMacPrintPageFileName(jobId: string, pageNumber: number, widthMm: number, heightMm: number): string {
  validateJobId(jobId);
  if (!Number.isInteger(pageNumber) || pageNumber <= 0 || pageNumber > 999_999) {
    throw new Error("印刷ページ番号が不正です。");
  }
  const index = String(pageNumber).padStart(6, "0");
  return `mclabel-${jobId}-p${index}-${formatMacPrintDimension(widthMm)}x${formatMacPrintDimension(heightMm)}mm.pdf`;
}

export function createMacPrintBundle({ jobId = crypto.randomUUID(), pages }: MacPrintBundleInput): MacPrintBundle {
  validateJobId(jobId);
  if (pages.length === 0 || pages.length > 65_534) throw new Error("印刷ページ数が不正です。");

  const manifestPages = pages.map((page, index) => {
    const widthMm = formatMacPrintDimension(page.widthMm);
    const heightMm = formatMacPrintDimension(page.heightMm);
    return {
      fileName: createMacPrintPageFileName(jobId, index + 1, page.widthMm, page.heightMm),
      widthMm,
      heightMm,
    };
  });
  const manifest: MacPrintManifest = {
    version: 2,
    jobId,
    pageCount: manifestPages.length,
    pages: manifestPages,
  };
  const archiveName = createMacPrintArchiveName(jobId);
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const bytes = createStoredZip([
    { fileName: "manifest.json", bytes: manifestBytes },
    ...manifestPages.map((page, index) => ({ fileName: page.fileName, bytes: pages[index].bytes })),
  ]);
  return {
    bytes,
    manifest,
    job: { version: 2, jobId, archiveName, pageCount: manifestPages.length },
  };
}

export function createMacShortcutUrl(shortcutName: string, printJob: MacPrintJob): string {
  if (!shortcutName.trim()) throw new Error("Macショートカット名が空です。");
  return (
    "shortcuts://run-shortcut" +
    `?name=${encodeURIComponent(shortcutName)}` +
    "&input=text" +
    `&text=${encodeURIComponent(JSON.stringify(printJob))}`
  );
}

export function createMacPrintAppUrl(printJob: MacPrintJob): string {
  return `fountain-label-print://print?job=${encodeURIComponent(JSON.stringify(printJob))}`;
}

export function isMacOs(navigatorValue: PlatformNavigator = navigator): boolean {
  const platform = navigatorValue.platform || navigatorValue.userAgent;
  return /mac/i.test(platform) && navigatorValue.maxTouchPoints < 2;
}

export function isMacPrintApp(navigatorValue: PlatformNavigator = navigator): boolean {
  return /LABELPRINT-MAC\//i.test(navigatorValue.userAgent);
}

export function startPdfDownload(bytes: Uint8Array, fileName: string): void {
  startFileDownload(bytes, fileName, "application/pdf");
}

export function startMacPrintBundleDownload(bytes: Uint8Array, fileName: string): void {
  startFileDownload(bytes, fileName, "application/zip");
}

export async function prepareMacPrintJob(
  job: MacPrintJob,
  bridge: NativePrintJobBridge | undefined = typeof window === "undefined"
    ? undefined
    : window.webkit?.messageHandlers?.printJob,
): Promise<void> {
  if (!bridge) throw new Error("Macアプリが印刷ファイルの保存準備を開始できませんでした。");
  const response = await bridge.postMessage({ action: "prepare", job });
  if (!response || typeof response !== "object" || (response as Record<string, unknown>).accepted !== true) {
    throw new Error("Macアプリが印刷ファイルの保存準備を確認できませんでした。");
  }
}

function parseNativePrintJobStatus(value: unknown, jobId: string): NativePrintJobStatus {
  if (!value || typeof value !== "object") {
    throw new Error("Macアプリから印刷状況を取得できませんでした。");
  }
  const record = value as Record<string, unknown>;
  const allowedStatuses = new Set(["prepared", "saving", "printing", "completed", "failed"]);
  if (record.jobId !== jobId || typeof record.status !== "string" || !allowedStatuses.has(record.status)) {
    throw new Error("Macアプリから受け取った印刷状況が不正です。");
  }
  return {
    jobId,
    status: record.status as NativePrintJobStatus["status"],
    message: typeof record.message === "string" ? record.message : "",
  };
}

export async function getMacPrintJobStatus(
  jobId: string,
  bridge: NativePrintJobBridge | undefined = typeof window === "undefined"
    ? undefined
    : window.webkit?.messageHandlers?.printJob,
): Promise<NativePrintJobStatus> {
  validateJobId(jobId);
  if (!bridge) throw new Error("Macアプリから印刷状況を取得できませんでした。");
  return parseNativePrintJobStatus(await bridge.postMessage({ action: "status", jobId }), jobId);
}

export async function waitForMacPrintJobCompletion(
  jobId: string,
  bridge?: NativePrintJobBridge,
  {
    pollIntervalMs = 500,
    timeoutMs = Number.POSITIVE_INFINITY,
    sleep = (milliseconds) => new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds)),
    now = Date.now,
  }: NativePrintWaitOptions = {},
): Promise<NativePrintJobStatus> {
  const deadline = now() + timeoutMs;
  while (true) {
    const status = await getMacPrintJobStatus(jobId, bridge);
    if (status.status === "completed") return status;
    if (status.status === "failed") {
      throw new Error(status.message || "Macアプリで印刷処理に失敗しました。");
    }
    if (now() >= deadline) {
      throw new Error("Macアプリから印刷完了の通知を確認できませんでした。");
    }
    await sleep(pollIntervalMs);
  }
}

export async function startPreparedMacPrintBundleDownload(
  bundle: MacPrintBundle,
  bridge?: NativePrintJobBridge,
  download: (bytes: Uint8Array, fileName: string) => void = startMacPrintBundleDownload,
  waitOptions?: NativePrintWaitOptions,
): Promise<NativePrintJobStatus> {
  await prepareMacPrintJob(bundle.job, bridge);
  download(bundle.bytes, bundle.job.archiveName);
  return waitForMacPrintJobCompletion(bundle.job.jobId, bridge, waitOptions);
}

function startFileDownload(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function launchMacShortcut(shortcutUrl: string): void {
  if (!shortcutUrl.startsWith("shortcuts://run-shortcut?")) {
    throw new Error("MacショートカットURLが不正です。");
  }
  window.location.href = shortcutUrl;
}

export function launchMacPrintApp(appUrl: string): void {
  if (!appUrl.startsWith("fountain-label-print://print?job=")) {
    throw new Error("Mac印刷アプリURLが不正です。");
  }
  window.location.href = appUrl;
}
