import { createCode128CanvasForPrinter } from "../barcode/generateCode128";
import { formatPrice } from "../format";
import { fitTextToSingleLine, LABEL_FONT_FAMILY } from "../label/fitText";
import { formatVariantValue } from "../label/formatVariant";
import { shouldStackDetailsRow } from "../label/layoutDetailsRow";
import { layoutProductName } from "../label/layoutProductName";
import { wrapTextLines } from "../label/wrapText";
import { mmToPt } from "../units/mmToPt";
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
export const LABEL_RENDER_SCALE = 2;
export const LABEL_RENDER_PIXELS_PER_MM = LABEL_PRINT_DOTS_PER_MM * LABEL_RENDER_SCALE;
export const LABEL_RENDER_DPI = LABEL_RENDER_PIXELS_PER_MM * 25.4;

export function mmToLabelRenderPixels(mm: number): number {
  return Math.round(mm * LABEL_PRINT_DOTS_PER_MM) * LABEL_RENDER_SCALE;
}

function labelRenderPixelsToMm(pixels: number): number {
  return pixels / LABEL_RENDER_PIXELS_PER_MM;
}

function snapToPrinterDot(pixels: number): number {
  return Math.max(Math.floor(pixels / LABEL_RENDER_SCALE) * LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
}

function ceilToPrinterDot(pixels: number): number {
  return Math.max(Math.ceil(pixels / LABEL_RENDER_SCALE) * LABEL_RENDER_SCALE, LABEL_RENDER_SCALE);
}

function resolveContent(row: CsvRow, elements: LabelElement[]) {
  const content = {
    brand: "",
    productName: "",
    variantParts: [] as string[],
    price: "",
    barcode: "",
    barcodeValue: "",
  };

  elements.forEach((element) => {
    if (element.type === "barcode") {
      content.barcode = row[element.sourceField] ?? "";
    } else if (element.type === "compositeText") {
      content.variantParts = element.sourceFields
        .map((field) => formatVariantValue(row[field]));
    } else {
      const value = row[element.sourceField] ?? "";
      if (element.role === "price") content.price = formatPrice(value);
      else content[element.role] = value;
    }
  });
  return content;
}

type TextLayoutStyle = { fontSize: number; minFontSize?: number; lineHeight: number; weight: number };
type LayoutSection = "product" | "barcode" | "footer";
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
type DetailsLayoutItem = {
  type: "details";
  section: "product";
  variant: string;
  price: string;
  variantFontSize: number;
  variantLineHeight: number;
  variantWeight: number;
  priceFontSize: number;
  priceLineHeight: number;
  priceWeight: number;
  rowGap: number;
  stacked: boolean;
  height: number;
};
type BarcodeLayoutItem = {
  type: "barcode";
  section: "barcode";
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};
type LayoutItem = TextLayoutItem | DetailsLayoutItem | BarcodeLayoutItem;
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

function createDetailsLayoutItem(
  parts: string[],
  price: string,
): DetailsLayoutItem | null {
  const variant = parts.join(" / ");
  if (!variant && !price) return null;
  const variantStyle = LABEL_LAYOUT_MM.variant;
  const priceStyle = LABEL_LAYOUT_MM.price;
  const variantFontSize = mmToLabelRenderPixels(variantStyle.fontSize);
  const variantLineHeight = mmToLabelRenderPixels(variantStyle.lineHeight);
  const priceFontSize = mmToLabelRenderPixels(priceStyle.fontSize);
  const priceLineHeight = mmToLabelRenderPixels(priceStyle.lineHeight);
  const rowGap = mmToLabelRenderPixels(LABEL_LAYOUT_MM.itemGap);
  const stacked = shouldStackDetailsRow({ variant, price });
  return {
    type: "details",
    section: "product",
    variant,
    price,
    variantFontSize,
    variantLineHeight,
    variantWeight: variantStyle.weight,
    priceFontSize,
    priceLineHeight,
    priceWeight: priceStyle.weight,
    rowGap,
    stacked,
    height: stacked
      ? variantLineHeight + rowGap + priceLineHeight
      : Math.max(variantLineHeight, priceLineHeight),
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
    context.fillText(line, x, y + item.lineHeight * (index + 0.5));
  });
}

function drawDetailsLayoutItem(
  context: CanvasRenderingContext2D,
  item: DetailsLayoutItem,
  y: number,
  contentLeft: number,
  contentRight: number,
): void {
  context.textBaseline = "middle";
  context.fillStyle = "#000000";
  const variantY = item.stacked ? y + item.variantLineHeight / 2 : y + item.height / 2;
  const priceY = item.stacked
    ? y + item.variantLineHeight + item.rowGap + item.priceLineHeight / 2
    : y + item.height / 2;
  if (item.variant) {
    context.font = `${item.variantWeight} ${item.variantFontSize}px ${LABEL_FONT_FAMILY}`;
    context.textAlign = "left";
    context.fillText(item.variant, contentLeft, variantY);
  }
  if (item.price) {
    context.font = `${item.priceWeight} ${item.priceFontSize}px ${LABEL_FONT_FAMILY}`;
    context.textAlign = "right";
    context.fillText(item.price, contentRight, priceY);
  }
}

function convertCanvasToMonochrome(canvas: HTMLCanvasElement): void {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ラベル描画を初期化できませんでした。");
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = (data[index] * 299 + data[index + 1] * 587 + data[index + 2] * 114) / 1000;
    const value = luminance < 192 ? 0 : 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
}

export async function renderLabelCanvas(
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
  const productNameItem = createProductNameLayoutItem(measureContext, content.productName, maxWidth);
  if (productNameItem) items.push(productNameItem);
  const detailsItem = createDetailsLayoutItem(content.variantParts, content.price);
  if (detailsItem) items.push(detailsItem);
  items.push({ type: "barcode", section: "barcode", canvas: barcodeCanvas, width: barcodeWidth, height: barcodeHeight });
  addText(content.barcodeValue || content.barcode, LABEL_LAYOUT_MM.barcodeValue, "barcode");
  addText(content.brand, LABEL_LAYOUT_MM.brand, "footer");

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
    } else if (item.type === "details") {
      drawDetailsLayoutItem(context, item, y, horizontalMargin, canvas.width - horizontalMargin);
    } else {
      context.imageSmoothingEnabled = false;
      context.drawImage(item.canvas, Math.floor((canvas.width - item.width) / 2), y);
    }
    y += item.height;
    const next = items[index + 1];
    if (next) y += getItemGap(item, next);
  });
  convertCanvasToMonochrome(canvas);
  return canvas;
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
): Promise<RenderedLabelEntry[]> {
  const printable = entries.flatMap((entry) => {
    const copies = Math.max(0, Math.floor(entry.copies));
    return copies > 0 ? [{ row: entry.row, copies }] : [];
  });
  if (printable.length === 0) throw new Error("印刷枚数が1枚以上の商品を選択してください。");

  return Promise.all(printable.map(async (entry) => ({
    canvas: await renderLabelCanvas(entry.row, elements, settings),
    copies: entry.copies,
  })));
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
    renderLabelEntries(entries, elements, settings),
  ]);
  const pdf = await PDFDocument.create();
  pdf.setTitle("Label Print");
  pdf.setCreator("LABEL PRINT");
  const pageWidth = mmToPt(settings.widthMm);

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
    renderLabelEntries(entries, elements, settings),
  ]);
  const widthMm = roundPrintDimensionMm(settings.widthMm);
  const pageTemplates = await Promise.all(renderedEntries.map(async ({ canvas, copies }) => {
    const heightMm = roundPrintDimensionMm(labelRenderPixelsToMm(canvas.height));
    const [pageWidth, pageHeight] = createPdfPageSize(widthMm, heightMm);
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
