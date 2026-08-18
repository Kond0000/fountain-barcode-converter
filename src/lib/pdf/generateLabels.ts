import { createCode128Canvas } from "../barcode/generateCode128";
import { formatPrice } from "../format";
import { wrapTextLines } from "../label/wrapText";
import { mmToPt, mmToPx } from "../units/mmToPt";
import type { CsvRow } from "../../types/csv";
import { calculateHorizontalMargin, LABEL_LAYOUT_MM, type LabelElement, type LabelSettings } from "../../types/label";

export type LabelPdfEntry = { row: CsvRow; copies: number };
export type DirectPrintPagePdf = {
  bytes: Uint8Array;
  widthMm: number;
  heightMm: number;
};

export type DirectPrintPages = { pages: DirectPrintPagePdf[] };

const PDF_DPI = 300;
const LABEL_FONT = '\"Hiragino Sans\", \"Yu Gothic\", \"Noto Sans JP\", sans-serif';

function resolveContent(row: CsvRow, elements: LabelElement[]) {
  const content = {
    brand: "",
    productName: "",
    variant: "",
    price: "",
    barcode: "",
    barcodeValue: "",
  };

  elements.forEach((element) => {
    if (element.type === "barcode") {
      content.barcode = row[element.sourceField] ?? "";
    } else if (element.type === "compositeText") {
      content.variant = element.sourceFields
        .map((field) => row[field]?.trim())
        .filter(Boolean)
        .join(element.separator);
    } else {
      const value = row[element.sourceField] ?? "";
      if (element.role === "price") content.price = formatPrice(value);
      else content[element.role] = value;
    }
  });
  return content;
}

type TextLayoutStyle = { fontSize: number; lineHeight: number; weight: number };
type LayoutSection = "product" | "price" | "barcode";
type TextLayoutItem = {
  type: "text";
  section: LayoutSection;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  weight: number;
  height: number;
};
type BarcodeLayoutItem = {
  type: "barcode";
  section: "barcode";
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};
type LayoutItem = TextLayoutItem | BarcodeLayoutItem;
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
  dpi: number,
): TextLayoutItem | null {
  if (!text.trim()) return null;
  const fontSize = Math.max(mmToPx(style.fontSize, dpi), 1);
  const lineHeight = Math.max(mmToPx(style.lineHeight, dpi), fontSize);
  context.font = `${style.weight} ${fontSize}px ${LABEL_FONT}`;
  const lines = wrapTextLines(text, maxWidth, (value) => context.measureText(value).width);
  if (lines.length === 0) return null;
  return {
    type: "text",
    section,
    lines,
    fontSize,
    lineHeight,
    weight: style.weight,
    height: lineHeight * lines.length,
  };
}

function getItemGap(current: LayoutItem, next: LayoutItem, dpi: number): number {
  if (current.section !== next.section) return mmToPx(LABEL_LAYOUT_MM.sectionGap, dpi);
  const gapMm = current.section === "barcode"
    ? LABEL_LAYOUT_MM.barcodeValueGap
    : LABEL_LAYOUT_MM.itemGap;
  return mmToPx(gapMm, dpi);
}

function drawTextLayoutItem(context: CanvasRenderingContext2D, item: TextLayoutItem, y: number): void {
  context.font = `${item.weight} ${item.fontSize}px ${LABEL_FONT}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#000000";
  item.lines.forEach((line, index) => {
    context.fillText(line, context.canvas.width / 2, y + item.lineHeight * (index + 0.5));
  });
}

export async function renderLabelCanvas(
  row: CsvRow,
  elements: LabelElement[],
  settings: LabelSettings,
  dpi = PDF_DPI,
): Promise<HTMLCanvasElement> {
  validateLabelSettings(settings);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(mmToPx(settings.widthMm, dpi), 1);
  const measureContext = canvas.getContext("2d");
  if (!measureContext) throw new Error("ラベル描画を初期化できませんでした。");

  const content = resolveContent(row, elements);
  if (!content.barcode) throw new Error("選択した商品のバーコード値が空です。");

  const verticalMargin = mmToPx(settings.marginMm, dpi);
  const horizontalMargin = mmToPx(calculateHorizontalMargin(settings.marginMm), dpi);
  const maxWidth = Math.max(canvas.width - horizontalMargin * 2, 1);
  const barcodeCanvas = await createCode128Canvas(content.barcode, { scale: 4, heightMm: 12 });
  const barcodeMaxHeight = mmToPx(LABEL_LAYOUT_MM.barcodeHeight, dpi);
  const scale = Math.min(maxWidth / barcodeCanvas.width, barcodeMaxHeight / barcodeCanvas.height);
  const barcodeWidth = Math.max(Math.floor(barcodeCanvas.width * scale), 1);
  const barcodeHeight = Math.max(Math.floor(barcodeCanvas.height * scale), 1);

  const items: LayoutItem[] = [];
  const addText = (text: string, style: TextLayoutStyle, section: LayoutSection) => {
    const item = createTextLayoutItem(measureContext, text, style, section, maxWidth, dpi);
    if (item) items.push(item);
  };
  addText(content.brand, LABEL_LAYOUT_MM.brand, "product");
  addText(content.productName, LABEL_LAYOUT_MM.productName, "product");
  addText(content.variant, LABEL_LAYOUT_MM.variant, "product");
  addText(content.price, LABEL_LAYOUT_MM.price, "price");
  items.push({ type: "barcode", section: "barcode", canvas: barcodeCanvas, width: barcodeWidth, height: barcodeHeight });
  addText(content.barcodeValue || content.barcode, LABEL_LAYOUT_MM.barcodeValue, "barcode");

  const contentHeight = items.reduce((total, item, index) => {
    const next = items[index + 1];
    return total + item.height + (next ? getItemGap(item, next, dpi) : 0);
  }, 0);
  canvas.height = Math.max(Math.ceil(verticalMargin * 2 + contentHeight), 1);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("ラベル描画を初期化できませんでした。");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  let y = verticalMargin;
  items.forEach((item, index) => {
    if (item.type === "text") {
      drawTextLayoutItem(context, item, y);
    } else {
      context.imageSmoothingEnabled = false;
      context.drawImage(item.canvas, Math.floor((canvas.width - item.width) / 2), y, item.width, item.height);
    }
    y += item.height;
    const next = items[index + 1];
    if (next) y += getItemGap(item, next, dpi);
  });
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
    const pageHeight = canvas.height * 72 / PDF_DPI;
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
    const heightMm = roundPrintDimensionMm(canvas.height * 25.4 / PDF_DPI);
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
