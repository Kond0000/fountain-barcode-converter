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
};

export function calculateIntegerModuleScale(baseWidthPx: number, maxWidthPx: number): number {
  if (!Number.isFinite(baseWidthPx) || !Number.isFinite(maxWidthPx) || baseWidthPx <= 0 || maxWidthPx <= 0) {
    throw new Error("バーコードの描画サイズが不正です。");
  }
  const scale = Math.floor(maxWidthPx / baseWidthPx);
  if (scale < 1) {
    throw new Error("バーコードがラベル幅に収まりません。横幅または余白を調整してください。");
  }
  return scale;
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
  const { default: bwipjs } = await import("bwip-js");
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

export async function createCode128CanvasForPrinter(
  value: string,
  options: PrinterBarcodeCanvasOptions,
): Promise<HTMLCanvasElement> {
  const probe = await createCode128Canvas(value, { scaleX: 1, scaleY: 1, heightMm: 1 });
  const scaleX = calculateIntegerModuleScale(probe.width, options.maxWidthPx);
  const scaleY = Math.max(Math.round(options.renderDpi / POINTS_PER_INCH), 1);
  return createCode128Canvas(value, {
    scaleX,
    scaleY,
    heightMm: calculateBwipHeightMm(options.targetHeightPx, scaleY),
  });
}
