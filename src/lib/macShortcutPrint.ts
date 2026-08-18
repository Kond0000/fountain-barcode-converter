import { createStoredZip } from "./zip/createStoredZip";

export const MAC_PRINT_SHORTCUT_NAME = "mC-Label3 Print";

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

type PlatformNavigator = Pick<Navigator, "maxTouchPoints" | "platform" | "userAgent">;

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

export function isMacOs(navigatorValue: PlatformNavigator = navigator): boolean {
  const platform = navigatorValue.platform || navigatorValue.userAgent;
  return /mac/i.test(platform) && navigatorValue.maxTouchPoints < 2;
}

export function startPdfDownload(bytes: Uint8Array, fileName: string): void {
  startFileDownload(bytes, fileName, "application/pdf");
}

export function startMacPrintBundleDownload(bytes: Uint8Array, fileName: string): void {
  startFileDownload(bytes, fileName, "application/zip");
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
