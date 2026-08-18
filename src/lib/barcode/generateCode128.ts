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
};

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

export function calculatePrinterAlignedWidth(maxWidthPx: number, scaleStep = 1): number {
  if (!Number.isFinite(maxWidthPx) || !Number.isFinite(scaleStep) || maxWidthPx <= 0 || scaleStep < 1) {
    throw new Error("バーコードの描画サイズが不正です。");
  }
  const safeScaleStep = Math.max(Math.round(scaleStep), 1);
  const width = Math.floor(maxWidthPx / safeScaleStep) * safeScaleStep;
  if (width < safeScaleStep) throw new Error("バーコードがラベル幅に収まりません。");
  return width;
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

function expandBarcodeToPrinterWidth(
  source: HTMLCanvasElement,
  targetWidth: number,
  scaleStep: number,
): HTMLCanvasElement {
  if (source.width > targetWidth) {
    throw new Error("バーコードがラベル幅に収まりません。横幅または余白を調整してください。");
  }
  if (source.width === targetWidth) return source;

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("バーコードを描画できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = false;

  const sourceColumns = Math.floor(source.width / scaleStep);
  const targetColumns = Math.floor(targetWidth / scaleStep);
  for (let column = 0; column < targetColumns; column += 1) {
    const sourceColumn = Math.min(
      Math.floor(column * sourceColumns / targetColumns),
      sourceColumns - 1,
    );
    context.drawImage(
      source,
      sourceColumn * scaleStep,
      0,
      scaleStep,
      source.height,
      column * scaleStep,
      0,
      scaleStep,
      source.height,
    );
  }
  return canvas;
}

export async function createCode128CanvasForPrinter(
  value: string,
  options: PrinterBarcodeCanvasOptions,
): Promise<HTMLCanvasElement> {
  const scaleStep = Math.max(Math.round(options.moduleScaleStep ?? 1), 1);
  const targetWidth = calculatePrinterAlignedWidth(options.maxWidthPx, scaleStep);
  const scaleY = Math.max(Math.round(options.renderDpi / POINTS_PER_INCH), 1);
  const source = await createCode128Canvas(value, {
    scaleX: scaleStep,
    scaleY,
    heightMm: calculateBwipHeightMm(options.targetHeightPx, scaleY),
  });
  return expandBarcodeToPrinterWidth(source, targetWidth, scaleStep);
}
