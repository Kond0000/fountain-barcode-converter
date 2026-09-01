import { createCode128CanvasForPrinter } from "../barcode/generateCode128";
import { formatPrice } from "../format";
import { fitTextToSingleLine, LABEL_FONT_FAMILY } from "../label/fitText";
import { formatBrandName } from "../label/formatBrand";
import { formatLabelField } from "../label/formatLabelField";
import { formatVariantValue } from "../label/formatVariant";
import { formatProductNumber } from "../label/formatProductNumber";
import { layoutProductName } from "../label/layoutProductName";
import { wrapTextLines } from "../label/wrapText";
import { MM_PER_INCH, mmToPt, POINTS_PER_INCH } from "../units/mmToPt";
import type { CsvRow } from "../../types/csv";
import {
  calculateHorizontalMargin,
  LABEL_LAYOUT_MM,
  PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
  type LabelElement,
  type LabelSettings,
} from "../../types/label";

export type LabelPdfEntry = { row: CsvRow; copies: number };
export type DirectPrintPagePdf = {
  bytes: Uint8Array;
  widthMm: number;
  heightMm: number;
};

export type DirectPrintPages = { pages: DirectPrintPagePdf[] };

export const LABEL_PRINT_DOTS_PER_MM = 8;
export const LABEL_PRINT_DPI = LABEL_PRINT_DOTS_PER_MM * 25.4;
// The printer is nominally 8 dots/mm (203.2 dpi), while the Star CUPS PPD
// rasterizes at 203 dpi. Match direct-print PDF/media dimensions to that
// declared raster so each native label pixel reaches CUPS as exactly one dot.
export const LABEL_CUPS_RASTER_DPI = 203;
export const LABEL_RENDER_SCALE = 2;
export const LABEL_RENDER_PIXELS_PER_MM = LABEL_PRINT_DOTS_PER_MM * LABEL_RENDER_SCALE;
export const LABEL_RENDER_DPI = LABEL_RENDER_PIXELS_PER_MM * 25.4;
export const LABEL_MONOCHROME_THRESHOLD = 128;

export function mmToLabelPrintPixels(mm: number): number {
  return Math.round(mm * LABEL_PRINT_DOTS_PER_MM);
}

export function mmToLabelRenderPixels(mm: number): number {
  return mmToLabelPrintPixels(mm) * LABEL_RENDER_SCALE;
}

export function labelPrintPixelsToMm(pixels: number): number {
  return pixels / LABEL_PRINT_DOTS_PER_MM;
}

export function labelPrintPixelsToPdfPoints(pixels: number): number {
  return pixels * POINTS_PER_INCH / LABEL_CUPS_RASTER_DPI;
}

export function labelRenderPixelsToMm(pixels: number): number {
  return pixels / LABEL_RENDER_PIXELS_PER_MM;
}

export function labelPrintPixelsToCupsMm(pixels: number): number {
  return pixels * MM_PER_INCH / LABEL_CUPS_RASTER_DPI;
}

function snapToPrinterDot(pixels: number): number {
  return Math.max(Math.floor(pixels / LABEL_RENDER_SCALE) * LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
}

function ceilToPrinterDot(pixels: number): number {
  return Math.max(Math.ceil(pixels / LABEL_RENDER_SCALE) * LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
}

export function snapCoordinateToPrinterDot(pixels: number): number {
  return Math.round(pixels / LABEL_RENDER_SCALE) * LABEL_RENDER_SCALE;
}

export type MonochromeRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

export function downsampleRgbaToMonochrome(
  source: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  scale = LABEL_RENDER_SCALE,
  threshold = LABEL_MONOCHROME_THRESHOLD,
): MonochromeRaster {
  if (
    !Number.isInteger(sourceWidth)
    || !Number.isInteger(sourceHeight)
    || !Number.isInteger(scale)
    || sourceWidth <= 0
    || sourceHeight <= 0
    || scale <= 0
    || sourceWidth % scale !== 0
    || sourceHeight % scale !== 0
    || source.length !== sourceWidth * sourceHeight * 4
    || !Number.isFinite(threshold)
    || threshold < 0
    || threshold > 255
  ) {
    throw new Error("ラベル画像をプリンタードットへ変換できませんでした。");
  }

  const width = sourceWidth / scale;
  const height = sourceHeight / scale;
  const data = new Uint8ClampedArray(width * height * 4);
  const samplesPerPixel = scale * scale;

  for (let targetY = 0; targetY < height; targetY += 1) {
    for (let targetX = 0; targetX < width; targetX += 1) {
      let luminanceTotal = 0;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const sourceX = targetX * scale + offsetX;
          const sourceY = targetY * scale + offsetY;
          const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
          const alpha = source[sourceIndex + 3] / 255;
          const red = source[sourceIndex] * alpha + 255 * (1 - alpha);
          const green = source[sourceIndex + 1] * alpha + 255 * (1 - alpha);
          const blue = source[sourceIndex + 2] * alpha + 255 * (1 - alpha);
          luminanceTotal += (red * 299 + green * 587 + blue * 114) / 1000;
        }
      }

      const value = luminanceTotal / samplesPerPixel < threshold ? 0 : 255;
      const targetIndex = (targetY * width + targetX) * 4;
      data[targetIndex] = value;
      data[targetIndex + 1] = value;
      data[targetIndex + 2] = value;
      data[targetIndex + 3] = 255;
    }
  }

  return { width, height, data };
}

function resolveContent(row: CsvRow, elements: LabelElement[]) {
  const content = {
    brand: "",
    productName: "",
    variantParts: [] as string[],
    price: "",
    barcode: "",
    barcodeValue: "",
    productNumber: "",
  };

  elements.forEach((element) => {
    if (element.type === "barcode") {
      content.barcode = row[element.sourceField] ?? "";
    } else if (element.type === "compositeText") {
      content.variantParts = element.sourceFields
        .map((field) => field ? formatVariantValue(row[field]) : "");
    } else {
      const value = row[element.sourceField] ?? "";
      if (element.role === "price") content.price = formatPrice(value);
      else content[element.role] = value;
    }
  });
  return content;
}

type TextLayoutStyle = { fontSize: number; minFontSize?: number; lineHeight: number; weight: number };
type LayoutSection = "product" | "barcode";
type TextAlignment = "left" | "center" | "right";
type TextLayoutItem = {
  type: "text";
  section: LayoutSection;
  alignment: TextAlignment;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  weight: number;
  height: number;
};
type DetailsBoxLayoutItem = {
  type: "detailsBox";
  section: "product";
  items: TextLayoutItem[];
  itemGap: number;
  height: number;
};
type BarcodeLayoutItem = {
  type: "barcode";
  section: "barcode";
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};
type LayoutItem = TextLayoutItem | DetailsBoxLayoutItem | BarcodeLayoutItem;
type RenderedLabelEntry = { canvas: HTMLCanvasElement; copies: number };

function roundPrintDimensionMm(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createPdfPageSize(widthMm: number, heightMm: number): [number, number] {
  return [mmToPt(widthMm), mmToPt(heightMm)];
}

export function calculateLabelPageCount(entries: LabelPdfEntry[]): number {
  return entries.reduce((total, entry) => total + Math.max(0, Math.floor(entry.copies)), 0);
}

function createTextLayoutItem(
  context: CanvasRenderingContext2D,
  text: string,
  style: TextLayoutStyle,
  section: LayoutSection,
  maxWidth: number,
  alignment: TextAlignment = "center",
): TextLayoutItem | null {
  if (!text.trim()) return null;
  const preferredFontSize = Math.max(mmToLabelRenderPixels(style.fontSize), LABEL_RENDER_SCALE);
  const preferredLineHeight = Math.max(mmToLabelRenderPixels(style.lineHeight), preferredFontSize);
  context.font = `${style.weight} ${preferredFontSize}px ${LABEL_FONT_FAMILY}`;

  const fitted = style.minFontSize === undefined
    ? null
    : fitTextToSingleLine({
      text,
      maxWidth,
      preferredFontSize,
      preferredLineHeight,
      minFontSize: mmToLabelRenderPixels(style.minFontSize),
      measureAtPreferredSize: (value) => context.measureText(value).width,
    });
  const fontSize = fitted ? snapToPrinterDot(fitted.fontSize) : preferredFontSize;
  const lineHeight = fitted ? snapToPrinterDot(fitted.lineHeight) : preferredLineHeight;
  const fittedText = fitted?.text ?? text;
  context.font = `${style.weight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
  const lines = fitted && !fitted.shouldWrap
    ? [fittedText]
    : wrapTextLines(fittedText, maxWidth, (value) => context.measureText(value).width);
  if (lines.length === 0) return null;
  return {
    type: "text",
    section,
    alignment,
    lines,
    fontSize,
    lineHeight,
    weight: style.weight,
    height: lineHeight * lines.length,
  };
}

function createProductNameLayoutItem(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): TextLayoutItem | null {
  if (!text.trim()) return null;
  const style = LABEL_LAYOUT_MM.productName;
  const preferredFontSize = mmToLabelRenderPixels(style.fontSize);
  const preferredLineHeight = mmToLabelRenderPixels(style.lineHeight);
  const layout = layoutProductName({
    text,
    maxCharacters: PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
    maxWidth,
    preferredFontSize,
    preferredLineHeight,
    minFontSize: mmToLabelRenderPixels(style.minFontSize),
    measure: (value, fontSize) => {
      context.font = `${style.weight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
      return context.measureText(value).width;
    },
  });
  const fontSize = snapToPrinterDot(layout.fontSize);
  const lineHeight = snapToPrinterDot(layout.lineHeight);
  return {
    type: "text",
    section: "product",
    alignment: "left",
    lines: layout.lines,
    fontSize,
    lineHeight,
    weight: style.weight,
    height: lineHeight * layout.lines.length,
  };
}

function createDetailsBoxLayoutItem(
  context: CanvasRenderingContext2D,
  details: Array<{ text: string; style: TextLayoutStyle }>,
  maxWidth: number,
): DetailsBoxLayoutItem | null {
  const itemGap = mmToLabelRenderPixels(LABEL_LAYOUT_MM.detailsBox.itemGap);
  const items = details.flatMap(({ text, style }) => {
    const item = createTextLayoutItem(context, text, style, "product", maxWidth, "left");
    return item ? [item] : [];
  });
  if (items.length === 0) return null;

  return {
    type: "detailsBox",
    section: "product",
    items,
    itemGap,
    height: items.reduce(
      (total, item, index) => total + item.height + (index > 0 ? itemGap : 0),
      0,
    ),
  };
}

function getItemGap(current: LayoutItem, next: LayoutItem): number {
  if (current.section !== next.section) return mmToLabelRenderPixels(LABEL_LAYOUT_MM.sectionGap);
  const gapMm = current.section === "barcode"
    ? LABEL_LAYOUT_MM.barcodeValueGap
    : LABEL_LAYOUT_MM.itemGap;
  return mmToLabelRenderPixels(gapMm);
}

function drawTextLayoutItem(
  context: CanvasRenderingContext2D,
  item: TextLayoutItem,
  y: number,
  contentLeft: number,
  contentRight: number,
): void {
  context.font = `${item.weight} ${item.fontSize}px ${LABEL_FONT_FAMILY}`;
  context.textAlign = item.alignment;
  context.textBaseline = "middle";
  context.fillStyle = "#000000";
  const x = item.alignment === "left"
    ? contentLeft
    : item.alignment === "right"
      ? contentRight
      : context.canvas.width / 2;
  item.lines.forEach((line, index) => {
    const baselineY = snapCoordinateToPrinterDot(y + item.lineHeight * (index + 0.5));
    context.fillText(line, x, baselineY);
  });
}

function drawDetailsBoxLayoutItem(
  context: CanvasRenderingContext2D,
  item: DetailsBoxLayoutItem,
  y: number,
  contentLeft: number,
  contentRight: number,
): void {
  let itemY = y;
  item.items.forEach((detail, index) => {
    drawTextLayoutItem(context, detail, itemY, contentLeft, contentRight);
    itemY += detail.height;
    if (index < item.items.length - 1) itemY += item.itemGap;
  });
}

function createPrinterDotCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  if (!sourceContext) throw new Error("ラベル描画を初期化できませんでした。");
  const sourceImage = sourceContext.getImageData(0, 0, source.width, source.height);
  const raster = downsampleRgbaToMonochrome(sourceImage.data, source.width, source.height);

  const canvas = document.createElement("canvas");
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ラベル描画を初期化できませんでした。");
  const image = context.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  context.putImageData(image, 0, 0);
  return canvas;
}

async function renderLabelSourceCanvas(
  row: CsvRow,
  elements: LabelElement[],
  settings: LabelSettings,
): Promise<HTMLCanvasElement> {
  validateLabelSettings(settings);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(mmToLabelRenderPixels(settings.widthMm), LABEL_RENDER_SCALE);
  const measureContext = canvas.getContext("2d");
  if (!measureContext) throw new Error("ラベル描画を初期化できませんでした。");

  const content = resolveContent(row, elements);
  if (!content.barcode) throw new Error("選択した商品のバーコード値が空です。");

  const verticalMargin = mmToLabelRenderPixels(settings.marginMm);
  const horizontalMargin = mmToLabelRenderPixels(calculateHorizontalMargin(settings.marginMm));
  const maxWidth = Math.max(canvas.width - horizontalMargin * 2, 1);
  const barcodeMaxHeight = mmToLabelRenderPixels(LABEL_LAYOUT_MM.barcodeHeight);
  const barcodeCanvas = await createCode128CanvasForPrinter(content.barcode, {
    maxWidthPx: maxWidth,
    targetHeightPx: barcodeMaxHeight,
    renderDpi: LABEL_RENDER_DPI,
    moduleScaleStep: LABEL_RENDER_SCALE,
    externalQuietZonePx: horizontalMargin,
  });
  const barcodeWidth = barcodeCanvas.width;
  const barcodeHeight = barcodeCanvas.height;

  const items: LayoutItem[] = [];
  const addText = (
    text: string,
    style: TextLayoutStyle,
    section: LayoutSection,
    alignment: TextAlignment = "center",
  ) => {
    const item = createTextLayoutItem(measureContext, text, style, section, maxWidth, alignment);
    if (item) items.push(item);
  };
  const hasBrandElement = elements.some((element) => element.type === "text" && element.role === "brand");
  addText(
    hasBrandElement ? formatBrandName(content.brand) : "",
    LABEL_LAYOUT_MM.brand,
    "product",
    "left",
  );
  const productNameItem = createProductNameLayoutItem(measureContext, content.productName, maxWidth);
  if (productNameItem) items.push(productNameItem);
  const [color = "", size = ""] = content.variantParts;
  const detailsBoxItem = createDetailsBoxLayoutItem(measureContext, [
    {
      text: formatLabelField("型番", formatProductNumber(content.productNumber)),
      style: LABEL_LAYOUT_MM.productNumber,
    },
    { text: formatLabelField("カラー", color), style: LABEL_LAYOUT_MM.variant },
    { text: formatLabelField("サイズ", size), style: LABEL_LAYOUT_MM.variant },
  ], maxWidth);
  if (detailsBoxItem) items.push(detailsBoxItem);
  addText(content.price, LABEL_LAYOUT_MM.price, "product", "right");
  items.push({ type: "barcode", section: "barcode", canvas: barcodeCanvas, width: barcodeWidth, height: barcodeHeight });
  addText(
    content.barcodeValue || content.barcode,
    LABEL_LAYOUT_MM.barcodeValue,
    "barcode",
  );

  const contentHeight = items.reduce((total, item, index) => {
    const next = items[index + 1];
    return total + item.height + (next ? getItemGap(item, next) : 0);
  }, 0);
  canvas.height = ceilToPrinterDot(verticalMargin * 2 + contentHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ラベル描画を初期化できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let y = verticalMargin;
  items.forEach((item, index) => {
    if (item.type === "text") {
      drawTextLayoutItem(context, item, y, horizontalMargin, canvas.width - horizontalMargin);
    } else if (item.type === "detailsBox") {
      drawDetailsBoxLayoutItem(context, item, y, horizontalMargin, canvas.width - horizontalMargin);
    } else {
      context.imageSmoothingEnabled = false;
      const barcodeX = snapCoordinateToPrinterDot((canvas.width - item.width) / 2);
      context.drawImage(item.canvas, barcodeX, snapCoordinateToPrinterDot(y));
    }
    y += item.height;
    const next = items[index + 1];
    if (next) y += getItemGap(item, next);
  });
  return canvas;
}

export async function renderLabelCanvas(
  row: CsvRow,
  elements: LabelElement[],
  settings: LabelSettings,
): Promise<HTMLCanvasElement> {
  return createPrinterDotCanvas(await renderLabelSourceCanvas(row, elements, settings));
}

export function validateLabelSettings(settings: LabelSettings): void {
  const { widthMm, marginMm } = settings;
  if (![widthMm, marginMm].every(Number.isFinite)) {
    throw new Error("ラベル設定には数値を入力してください。");
  }
  if (widthMm <= 0) {
    throw new Error("ラベルの横幅は0より大きくしてください。");
  }
  if (marginMm < 0 || calculateHorizontalMargin(marginMm) * 2 >= widthMm) {
    throw new Error("左右余白がラベル横幅の半分未満になるよう、上下余白を調整してください。");
  }
}

async function renderLabelEntries(
  entries: LabelPdfEntry[],
  elements: LabelElement[],
  settings: LabelSettings,
  output: "highResolution" | "printerDots",
): Promise<RenderedLabelEntry[]> {
  const printable = entries.flatMap((entry) => {
    const copies = Math.max(0, Math.floor(entry.copies));
    return copies > 0 ? [{ row: entry.row, copies }] : [];
  });
  if (printable.length === 0) throw new Error("印刷枚数が1枚以上の商品を選択してください。");

  return Promise.all(printable.map(async (entry) => {
    const sourceCanvas = await renderLabelSourceCanvas(entry.row, elements, settings);
    return {
      canvas: output === "printerDots" ? createPrinterDotCanvas(sourceCanvas) : sourceCanvas,
      copies: entry.copies,
    };
  }));
}

export async function generateLabelsPdf(
  entries: LabelPdfEntry[],
  elements: LabelElement[],
  settings: LabelSettings,
): Promise<Uint8Array> {
  validateLabelSettings(settings);
  if (entries.length === 0) throw new Error("印刷する商品を1件以上選択してください。");

  const [{ PDFDocument }, renderedEntries] = await Promise.all([
    import("pdf-lib"),
    renderLabelEntries(entries, elements, settings, "highResolution"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Label Print");
  pdf.setCreator("LABEL PRINT");
  const pageWidth = mmToPt(labelRenderPixelsToMm(renderedEntries[0].canvas.width));

  for (const { canvas, copies } of renderedEntries) {
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const pageHeight = mmToPt(labelRenderPixelsToMm(canvas.height));
    for (let copy = 0; copy < copies; copy += 1) {
      const page = pdf.addPage([pageWidth, pageHeight]);
      page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    }
  }

  if (pdf.getPageCount() === 0) throw new Error("印刷枚数が1枚以上の商品を選択してください。");
  return pdf.save();
}

export async function generateDirectPrintPages(
  entries: LabelPdfEntry[],
  elements: LabelElement[],
  settings: LabelSettings,
): Promise<DirectPrintPages> {
  validateLabelSettings(settings);
  if (entries.length === 0) throw new Error("印刷する商品を1件以上選択してください。");

  const [{ PDFDocument }, renderedEntries] = await Promise.all([
    import("pdf-lib"),
    renderLabelEntries(entries, elements, settings, "printerDots"),
  ]);
  const pageTemplates = await Promise.all(renderedEntries.map(async ({ canvas, copies }) => {
    const widthMm = roundPrintDimensionMm(labelPrintPixelsToCupsMm(canvas.width));
    const heightMm = roundPrintDimensionMm(labelPrintPixelsToCupsMm(canvas.height));
    const pageWidth = labelPrintPixelsToPdfPoints(canvas.width);
    const pageHeight = labelPrintPixelsToPdfPoints(canvas.height);
    const pdf = await PDFDocument.create();
    pdf.setTitle("mC-Label3 Print");
    pdf.setCreator("LABEL PRINT");
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
    return { bytes: await pdf.save(), widthMm, heightMm, copies };
  }));

  const pages = pageTemplates.flatMap(({ bytes, widthMm: pageWidthMm, heightMm, copies }) =>
    Array.from({ length: copies }, () => ({ bytes, widthMm: pageWidthMm, heightMm })),
  );

  if (pages.length !== calculateLabelPageCount(entries)) {
    throw new Error("PDFのページ数と印刷枚数が一致しません。");
  }
  return { pages };
}

export type PdfDownload = { fileName: string; url: string };

export function createPdfDownload(bytes: Uint8Array, fileName: string): PdfDownload {
  const blob = new Blob([bytes], { type: "application/pdf" });
  return { fileName, url: URL.createObjectURL(blob) };
}
