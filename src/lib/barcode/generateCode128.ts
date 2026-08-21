import { MM_PER_INCH, POINTS_PER_INCH } from "../units/mmToPt";

export type BarcodeCanvasOptions = {
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  heightMm?: number;
};

export type PrinterBarcodeCanvasOptions = {
  maxWidthPx: number;
  targetHeightPx: number;
  renderDpi: number;
  moduleScaleStep?: number;
  externalQuietZonePx?: number;
};

export const CODE128_QUIET_ZONE_MODULES = 10;

export function calculateIntegerModuleScale(
  baseWidthPx: number,
  maxWidthPx: number,
  scaleStep = 1,
): number {
  if (
    !Number.isFinite(baseWidthPx)
    || !Number.isFinite(maxWidthPx)
    || !Number.isFinite(scaleStep)
    || baseWidthPx <= 0
    || maxWidthPx <= 0
    || scaleStep < 1
  ) {
    throw new Error("バーコードの描画サイズが不正です。");
  }
  const safeScaleStep = Math.max(Math.round(scaleStep), 1);
  const maxScale = Math.floor(maxWidthPx / baseWidthPx);
  const scale = maxScale - (maxScale % safeScaleStep);
  if (scale < 1) {
    throw new Error("バーコードがラベル幅に収まりません。横幅または余白を調整してください。");
  }
  return scale;
}

export function calculateCode128ModuleScale(
  baseWidthPx: number,
  maxWidthPx: number,
  externalQuietZonePx = 0,
  scaleStep = 1,
): number {
  if (!Number.isFinite(externalQuietZonePx) || externalQuietZonePx < 0) {
    throw new Error("バーコードの余白が不正です。");
  }
  const safeScaleStep = Math.max(Math.round(scaleStep), 1);
  const maximumScale = calculateIntegerModuleScale(baseWidthPx, maxWidthPx, safeScaleStep);
  for (let scale = maximumScale; scale >= safeScaleStep; scale -= safeScaleStep) {
    const internalQuietZone = Math.max(
      CODE128_QUIET_ZONE_MODULES * scale - externalQuietZonePx,
      0,
    );
    if (baseWidthPx * scale + internalQuietZone * 2 <= maxWidthPx) return scale;
  }
  throw new Error("バーコードがラベル幅に収まりません。横幅または余白を調整してください。");
}

export function calculateBwipHeightMm(targetHeightPx: number, scaleY: number): number {
  const safeTargetHeight = Math.max(Math.round(targetHeightPx), 2);
  const safeScaleY = Math.max(Math.round(scaleY), 1);
  // bwip-js converts millimetres at 72 dpi and rounds the result up. Subtracting
  // one target dot keeps the native canvas at the requested printer-dot height.
  return ((safeTargetHeight - 1) / safeScaleY / POINTS_PER_INCH) * MM_PER_INCH;
}

export async function generateCode128Canvas(
  value: string,
  canvas: HTMLCanvasElement,
  options: BarcodeCanvasOptions = {},
): Promise<HTMLCanvasElement> {
  if (!value) throw new Error("バーコード値が空です。");
  const { default: bwipjs } = await import("bwip-js/browser");
  const scaleX = options.scaleX ?? options.scale ?? 3;
  const scaleY = options.scaleY ?? options.scale ?? scaleX;
  bwipjs.toCanvas(canvas, {
    bcid: "code128",
    text: value,
    scaleX,
    scaleY,
    height: options.heightMm ?? 10,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
    backgroundcolor: "FFFFFF",
  });
  return canvas;
}

export function createCode128Canvas(value: string, options?: BarcodeCanvasOptions): Promise<HTMLCanvasElement> {
  return generateCode128Canvas(value, document.createElement("canvas"), options);
}

function addCode128QuietZones(
  source: HTMLCanvasElement,
  moduleScale: number,
  externalQuietZonePx: number,
): HTMLCanvasElement {
  const quietZoneWidth = Math.max(
    CODE128_QUIET_ZONE_MODULES * moduleScale - externalQuietZonePx,
    0,
  );
  const canvas = document.createElement("canvas");
  canvas.width = source.width + quietZoneWidth * 2;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("バーコードを描画できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, quietZoneWidth, 0);
  return canvas;
}

export async function createCode128CanvasForPrinter(
  value: string,
  options: PrinterBarcodeCanvasOptions,
): Promise<HTMLCanvasElement> {
  const scaleStep = Math.max(Math.round(options.moduleScaleStep ?? 1), 1);
  const externalQuietZonePx = Math.max(Math.floor(options.externalQuietZonePx ?? 0), 0);
  const scaleY = Math.max(Math.round(options.renderDpi / POINTS_PER_INCH), 1);
  const heightMm = calculateBwipHeightMm(options.targetHeightPx, scaleY);
  const base = await createCode128Canvas(value, {
    scaleX: 1,
    scaleY,
    heightMm,
  });
  const moduleScale = calculateCode128ModuleScale(
    base.width,
    options.maxWidthPx,
    externalQuietZonePx,
    scaleStep,
  );
  const source = moduleScale === 1
    ? base
    : await createCode128Canvas(value, { scaleX: moduleScale, scaleY, heightMm });
  return addCode128QuietZones(source, moduleScale, externalQuietZonePx);
}
