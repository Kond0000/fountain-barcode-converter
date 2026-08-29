import { createCode128CanvasForPrinter } from "../barcode/generateCode128";
import { formatPrice } from "../format";
import { formatBrandName } from "../label/formatBrand";
import { formatVariantValue } from "../label/formatVariant";
import { formatProductNumber } from "../label/formatProductNumber";
import {
  calculateVariantCenterY,
  fitVariantTextToSingleLine,
  getVariantColumns,
} from "../label/layoutVariant";
import { LABEL_FONT_FAMILY, normalizeSingleLineText } from "../label/fitText";
import { wrapTextLines } from "../label/wrapText";
import { mmToPt } from "../units/mmToPt";
import type { CsvRow } from "../../types/csv";
import type { LabelElement } from "../../types/label";

export type BarcodeTableEntry = { row: CsvRow; copies: number; imageFile?: File };

export const BARCODE_TABLE_PAGE_WIDTH_MM = 210;
export const BARCODE_TABLE_PAGE_HEIGHT_MM = 297;
export const BARCODE_TABLE_CARD_COLUMNS = 4;
export const BARCODE_TABLE_CARD_ROWS = 4;
export const BARCODE_TABLE_ITEMS_PER_PAGE =
  BARCODE_TABLE_CARD_COLUMNS * BARCODE_TABLE_CARD_ROWS;
export const BARCODE_TABLE_PIXELS_PER_MM = 16;
export const BARCODE_TABLE_ACCENT_COLOR = "#b8b8b3";
export const BARCODE_TABLE_VARIANT_PRICE_GAP_MM = 1;
export const BARCODE_TABLE_BRAND_PRODUCT_GAP_MM = 0.9;
export const BARCODE_TABLE_PRODUCT_COLOR_GAP_MM = 0.5;
export const BARCODE_TABLE_COLOR_FONT_SIZE_MM = 1.9;
export const BARCODE_TABLE_COLOR_FONT_WEIGHT = 700;
export const BARCODE_TABLE_COLOR_TEXT_COLOR = "#3f3f3f";

export type BarcodeTableSizeLayout =
  | "image-corner-box"
  | "editorial-rail"
  | "corner-badge"
  | "metadata-row"
  | "image-footer";

export function getBarcodeTableSizeLayout(): BarcodeTableSizeLayout {
  return "image-corner-box";
}

const PAGE_MARGIN_MM = 6;
const GRID_TOP_MM = 24;
const GRID_BOTTOM_MM = 287;
const CARD_GAP_MM = 1.3;
const CARD_PADDING_MM = 2;
const CARD_IMAGE_HEIGHT_MM = 28;
const CARD_BARCODE_AREA_HEIGHT_MM = 11.2;
const CARD_BARCODE_VALUE_HEIGHT_MM = 3.3;
const CARD_BARCODE_BOTTOM_PADDING_MM = 1;
const CARD_BARCODE_VALUE_GAP_MM = 0.6;
const MAX_PDF_IMAGE_BYTES = 15 * 1024 * 1024;
const SUPPORTED_PDF_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type DecodedPdfImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

function mmToPixels(mm: number): number {
  return Math.round(mm * BARCODE_TABLE_PIXELS_PER_MM);
}

export function createBarcodeTablePageSize(): [number, number] {
  return [mmToPt(BARCODE_TABLE_PAGE_WIDTH_MM), mmToPt(BARCODE_TABLE_PAGE_HEIGHT_MM)];
}

export function createBarcodeTableCardSize(): { widthMm: number; heightMm: number } {
  return {
    widthMm: (
      BARCODE_TABLE_PAGE_WIDTH_MM
      - PAGE_MARGIN_MM * 2
      - CARD_GAP_MM * (BARCODE_TABLE_CARD_COLUMNS - 1)
    ) / BARCODE_TABLE_CARD_COLUMNS,
    heightMm: (
      GRID_BOTTOM_MM
      - GRID_TOP_MM
      - CARD_GAP_MM * (BARCODE_TABLE_CARD_ROWS - 1)
    ) / BARCODE_TABLE_CARD_ROWS,
  };
}

export function getBarcodeTableEntries(entries: BarcodeTableEntry[]): BarcodeTableEntry[] {
  return entries.filter((entry) => Math.max(0, Math.floor(entry.copies)) > 0);
}

export function calculateBarcodeTablePageCount(entries: BarcodeTableEntry[]): number {
  return Math.ceil(getBarcodeTableEntries(entries).length / BARCODE_TABLE_ITEMS_PER_PAGE);
}

export function usesBarcodeTablePlaceholder(entry: BarcodeTableEntry): boolean {
  return !entry.imageFile;
}

export function getBarcodeTableVariantColumns(variantParts: string[]): {
  color: string;
  size: string;
} {
  const columns = getVariantColumns(variantParts);
  return {
    color: columns.color || "-",
    size: columns.size,
  };
}

export function formatBarcodeTableSizeTag(size: string): string {
  const value = normalizeSingleLineText(size).trim();
  return value ? `SIZE ${value}` : "";
}

export function formatBarcodeTableBrand(brand: string): string {
  return formatBrandName(brand);
}

export function formatBarcodeTableMetadata(brand: string, productNumber: string): string {
  return [
    formatBarcodeTableBrand(brand),
    formatProductNumber(productNumber),
  ].filter(Boolean).join(" | ");
}

export function formatBarcodeTableCodeValue(barcodeValue: string, barcode: string): string {
  return barcodeValue || barcode;
}

function resolveBarcodeTableContent(row: CsvRow, elements: LabelElement[]) {
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
        .map((field) => formatVariantValue(row[field]));
    } else {
      const value = row[element.sourceField] ?? "";
      if (element.role === "price") content.price = formatPrice(value);
      else content[element.role] = value;
    }
  });
  return content;
}

function setFont(
  context: CanvasRenderingContext2D,
  fontSizeMm: number,
  weight = 400,
): void {
  context.font = `${weight} ${mmToPixels(fontSizeMm)}px ${LABEL_FONT_FAMILY}`;
}

function truncateText(
  context: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  const text = normalizeSingleLineText(value);
  if (context.measureText(text).width <= maxWidth) return text;
  const suffix = "...";
  let start = 0;
  let end = text.length;
  while (start < end) {
    const middle = Math.ceil((start + end) / 2);
    if (context.measureText(`${text.slice(0, middle)}${suffix}`).width <= maxWidth) {
      start = middle;
    } else {
      end = middle - 1;
    }
  }
  return start > 0 ? `${text.slice(0, start)}${suffix}` : suffix;
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(truncateText(context, text, width), left + width / 2, top + height / 2);
}

function drawSizeFooterBand(
  context: CanvasRenderingContext2D,
  size: string,
  imageLeft: number,
  imageTop: number,
  imageWidth: number,
  imageHeight: number,
): void {
  const text = formatBarcodeTableSizeTag(size);
  if (!text) return;

  const inset = mmToPixels(0.8);
  const horizontalPadding = mmToPixels(1.2);
  const width = imageWidth - inset * 2;
  const height = mmToPixels(5.2);
  const left = imageLeft + inset;
  const top = imageTop + imageHeight - inset - height;

  context.fillStyle = "#ffffff";
  context.fillRect(left, top, width, height);
  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.22));
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left + width, top);
  context.stroke();

  setFont(context, 2.05, 800);
  context.fillStyle = "#111111";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillText(
    truncateText(context, text, width - horizontalPadding * 2),
    left + width - horizontalPadding,
    top + height / 2,
  );
}

function drawSizeCornerBadge(
  context: CanvasRenderingContext2D,
  size: string,
  cardLeft: number,
  cardTop: number,
  cardWidth: number,
): void {
  const text = formatBarcodeTableSizeTag(size);
  if (!text) return;

  const inset = mmToPixels(0.8);
  const horizontalPadding = mmToPixels(1.1);
  const minWidth = mmToPixels(10.5);
  const maxWidth = mmToPixels(17);
  const height = mmToPixels(6.5);
  setFont(context, 1.85, 800);
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, context.measureText(text).width + horizontalPadding * 2),
  );
  const left = cardLeft + cardWidth - inset - width;
  const top = cardTop + inset;

  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.25));
  context.strokeRect(left, top, width, height);
  context.fillStyle = "#111111";
  drawCenteredText(
    context,
    text,
    left + horizontalPadding,
    top,
    width - horizontalPadding * 2,
    height,
  );
}

function drawSizeEditorialRail(
  context: CanvasRenderingContext2D,
  size: string,
  imageLeft: number,
  imageTop: number,
  imageWidth: number,
  imageHeight: number,
): void {
  const text = formatBarcodeTableSizeTag(size);
  if (!text) return;

  const right = imageLeft + imageWidth - mmToPixels(0.9);
  const railWidth = mmToPixels(12.5);
  const railY = imageTop + imageHeight - mmToPixels(5.1);
  const cornerWidth = mmToPixels(4.8);
  const cornerY = imageTop + imageHeight - mmToPixels(0.9);

  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.22));
  context.beginPath();
  context.moveTo(right - railWidth, railY);
  context.lineTo(right, railY);
  context.moveTo(right - cornerWidth, cornerY);
  context.lineTo(right, cornerY);
  context.lineTo(right, cornerY - mmToPixels(1.3));
  context.stroke();

  setFont(context, 2.05, 800);
  context.fillStyle = "#111111";
  context.textAlign = "right";
  context.textBaseline = "middle";
  context.fillText(
    truncateText(context, text, railWidth - mmToPixels(0.8)),
    right - mmToPixels(0.5),
    railY + mmToPixels(2.2),
  );
}

function drawSizeImageCornerBox(
  context: CanvasRenderingContext2D,
  size: string,
  imageLeft: number,
  imageTop: number,
  imageWidth: number,
  imageHeight: number,
): void {
  const text = formatBarcodeTableSizeTag(size);
  if (!text) return;

  const horizontalPadding = mmToPixels(1.1);
  const minWidth = mmToPixels(12);
  const maxWidth = mmToPixels(18);
  const height = mmToPixels(5.4);
  setFont(context, 2.05, 800);
  const width = Math.min(
    maxWidth,
    Math.max(minWidth, context.measureText(text).width + horizontalPadding * 2),
  );
  const left = imageLeft + imageWidth - width;
  const top = imageTop + imageHeight - height;

  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.22));
  context.strokeRect(left, top, width, height);
  context.fillStyle = "#111111";
  drawCenteredText(
    context,
    text,
    left + horizontalPadding,
    top,
    width - horizontalPadding * 2,
    height,
  );
}

function drawProductName(
  context: CanvasRenderingContext2D,
  productName: string,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  const lines = wrapTextLines(
    normalizeSingleLineText(productName),
    width,
    (value) => context.measureText(value).width,
  );
  const visibleLines = lines.slice(0, 2);
  const lineHeight = mmToPixels(3.1);
  const startY = top + (height - visibleLines.length * lineHeight) / 2;
  context.textAlign = "left";
  context.textBaseline = "top";
  visibleLines.forEach((line, index) => {
    const shouldTruncate = index === visibleLines.length - 1 && lines.length > visibleLines.length;
    const visibleLine = shouldTruncate ? truncateText(context, `${line}...`, width) : line;
    context.fillText(truncateText(context, visibleLine, width), left, startY + index * lineHeight);
  });
}

async function decodePdfImage(file: File): Promise<DecodedPdfImage> {
  if (!SUPPORTED_PDF_IMAGE_TYPES.has(file.type)) {
    throw new Error(`「${file.name}」はPNG・JPEG・WebP画像ではありません。`);
  }
  if (file.size > MAX_PDF_IMAGE_BYTES) {
    throw new Error(`「${file.name}」は15MB以下の画像を選択してください。`);
  }

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      };
    } catch {
      throw new Error(`「${file.name}」を画像として読み込めませんでした。`);
    }
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`「${file.name}」を画像として読み込めませんでした。`);
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    dispose: () => URL.revokeObjectURL(url),
  };
}

function drawImagePlaceholder(
  context: CanvasRenderingContext2D,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  context.fillStyle = "#ffffff";
  context.fillRect(left, top, width, height);

  const iconWidth = mmToPixels(12);
  const iconHeight = mmToPixels(8.5);
  const iconLeft = left + (width - iconWidth) / 2;
  const iconTop = top + (height - iconHeight) / 2 - mmToPixels(1.5);
  context.strokeStyle = "#77736c";
  context.lineWidth = Math.max(1, mmToPixels(0.25));
  context.strokeRect(iconLeft, iconTop, iconWidth, iconHeight);
  context.beginPath();
  context.arc(
    iconLeft + mmToPixels(3),
    iconTop + mmToPixels(2.5),
    mmToPixels(0.8),
    0,
    Math.PI * 2,
  );
  context.stroke();
  context.beginPath();
  context.moveTo(iconLeft + mmToPixels(1.2), iconTop + iconHeight - mmToPixels(1.1));
  context.lineTo(iconLeft + mmToPixels(4.7), iconTop + mmToPixels(4.6));
  context.lineTo(iconLeft + mmToPixels(7), iconTop + mmToPixels(6.3));
  context.lineTo(iconLeft + mmToPixels(9.2), iconTop + mmToPixels(3.8));
  context.lineTo(iconLeft + iconWidth - mmToPixels(1), iconTop + iconHeight - mmToPixels(1.1));
  context.stroke();

  setFont(context, 1.8, 600);
  context.fillStyle = "#55524d";
  drawCenteredText(
    context,
    "NO IMAGE / SAMPLE",
    left,
    iconTop + iconHeight + mmToPixels(1.2),
    width,
    mmToPixels(3),
  );
}

export function normalizeCatalogImageBackgroundPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): void {
  const pixelCount = width * height;
  if (pixelCount <= 0 || pixels.length < pixelCount * 4) return;

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const isNearWhiteNeutral = (pixelIndex: number) => {
    const offset = pixelIndex * 4;
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const alpha = pixels[offset + 3];
    return alpha > 0
      && Math.min(red, green, blue) >= 230
      && Math.max(red, green, blue) - Math.min(red, green, blue) <= 16;
  };
  const enqueue = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    if (!isNearWhiteNeutral(pixelIndex)) return;
    queue[queueEnd] = pixelIndex;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const pixelIndex = queue[queueStart];
    queueStart += 1;
    const offset = pixelIndex * 4;
    pixels[offset] = 255;
    pixels[offset + 1] = 255;
    pixels[offset + 2] = 255;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y + 1 < height) enqueue(pixelIndex + width);
  }
}

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: DecodedPdfImage,
  left: number,
  top: number,
  width: number,
  height: number,
): void {
  context.fillStyle = "#ffffff";
  context.fillRect(left, top, width, height);
  const scale = Math.min(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  const normalizedCanvas = document.createElement("canvas");
  normalizedCanvas.width = Math.max(1, Math.round(imageWidth));
  normalizedCanvas.height = Math.max(1, Math.round(imageHeight));
  const normalizedContext = normalizedCanvas.getContext("2d", { willReadFrequently: true });
  if (!normalizedContext) {
    throw new Error("商品画像の背景を処理できませんでした。");
  }
  normalizedContext.imageSmoothingEnabled = true;
  normalizedContext.imageSmoothingQuality = "high";
  normalizedContext.drawImage(
    image.source,
    0,
    0,
    normalizedCanvas.width,
    normalizedCanvas.height,
  );
  const imageData = normalizedContext.getImageData(
    0,
    0,
    normalizedCanvas.width,
    normalizedCanvas.height,
  );
  normalizeCatalogImageBackgroundPixels(
    imageData.data,
    normalizedCanvas.width,
    normalizedCanvas.height,
  );
  normalizedContext.putImageData(imageData, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    normalizedCanvas,
    left + (width - imageWidth) / 2,
    top + (height - imageHeight) / 2,
    imageWidth,
    imageHeight,
  );
}

function drawPageHeader(
  context: CanvasRenderingContext2D,
  title: string,
  pageNumber: number,
  totalPages: number,
  totalEntries: number,
): void {
  const margin = mmToPixels(PAGE_MARGIN_MM);
  const badgeWidth = mmToPixels(27);
  const badgeHeight = mmToPixels(8);
  const badgeTop = mmToPixels(5.7);
  const headerCenterY = badgeTop + badgeHeight / 2;
  setFont(context, 4.8, 800);
  context.fillStyle = "#111111";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(
    truncateText(context, title, context.canvas.width - margin * 2 - badgeWidth - mmToPixels(8)),
    margin + mmToPixels(3),
    headerCenterY,
  );

  const badgeLeft = context.canvas.width - margin - badgeWidth;
  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.35));
  context.strokeRect(badgeLeft, badgeTop, badgeWidth, badgeHeight);
  setFont(context, 3.2, 700);
  context.fillStyle = "#111111";
  drawCenteredText(
    context,
    `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`,
    badgeLeft,
    badgeTop,
    badgeWidth,
    badgeHeight,
  );

  setFont(context, 2.15, 700);
  context.fillStyle = "#111111";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillText("SELECTED GOODS / DROP CATALOG", margin, mmToPixels(18.3));
  context.textAlign = "right";
  context.fillText(
    `${totalEntries} ITEMS / NO IMAGE = SAMPLE`,
    context.canvas.width - margin,
    mmToPixels(18.3),
  );
  context.beginPath();
  context.moveTo(margin, mmToPixels(21.5));
  context.lineTo(context.canvas.width - margin, mmToPixels(21.5));
  context.stroke();
}

function drawPageFooter(context: CanvasRenderingContext2D): void {
  const margin = mmToPixels(PAGE_MARGIN_MM);
  context.strokeStyle = "#111111";
  context.lineWidth = Math.max(1, mmToPixels(0.3));
  context.beginPath();
  context.moveTo(margin, mmToPixels(289.2));
  context.lineTo(context.canvas.width - margin, mmToPixels(289.2));
  context.stroke();
  setFont(context, 1.9, 600);
  context.fillStyle = "#111111";
  context.textBaseline = "bottom";
  context.textAlign = "left";
  context.fillText(
    "バーコードが読み取れない場合は、下部の商品コードをご確認ください。",
    margin,
    mmToPixels(294),
  );
}

async function renderBarcodeTablePage(
  entries: BarcodeTableEntry[],
  elements: LabelElement[],
  title: string,
  pageNumber: number,
  totalPages: number,
  totalEntries: number,
  startIndex: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = mmToPixels(BARCODE_TABLE_PAGE_WIDTH_MM);
  canvas.height = mmToPixels(BARCODE_TABLE_PAGE_HEIGHT_MM);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("バーコード一覧PDFの描画を初期化できませんでした。");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawPageHeader(context, title, pageNumber, totalPages, totalEntries);
  drawPageFooter(context);

  const contents = entries.map((entry) => resolveBarcodeTableContent(entry.row, elements));
  if (contents.some((content) => !content.barcode.trim())) {
    throw new Error("選択した商品のバーコード値が空です。");
  }

  const { widthMm: cardWidthMm, heightMm: cardHeightMm } = createBarcodeTableCardSize();
  const cardWidth = mmToPixels(cardWidthMm);
  const cardHeight = mmToPixels(cardHeightMm);
  const cardGap = mmToPixels(CARD_GAP_MM);
  const cardPadding = mmToPixels(CARD_PADDING_MM);
  const baseImageHeight = mmToPixels(CARD_IMAGE_HEIGHT_MM);
  const barcodeAreaHeight = mmToPixels(CARD_BARCODE_AREA_HEIGHT_MM);
  const barcodeValueHeight = mmToPixels(CARD_BARCODE_VALUE_HEIGHT_MM);
  const barcodeMaxWidth = cardWidth - mmToPixels(5);
  const barcodes = await Promise.all(contents.map((content) => createCode128CanvasForPrinter(
    content.barcode,
    {
      maxWidthPx: barcodeMaxWidth,
      targetHeightPx: mmToPixels(7.4),
      renderDpi: BARCODE_TABLE_PIXELS_PER_MM * 25.4,
      externalQuietZonePx: mmToPixels(1.4),
    },
  )));

  const decodedImages: Array<DecodedPdfImage | null> = [];
  for (const entry of entries) {
    decodedImages.push(entry.imageFile ? await decodePdfImage(entry.imageFile) : null);
  }

  try {
    entries.forEach((_entry, itemIndex) => {
      const column = itemIndex % BARCODE_TABLE_CARD_COLUMNS;
      const row = Math.floor(itemIndex / BARCODE_TABLE_CARD_COLUMNS);
      const left = mmToPixels(PAGE_MARGIN_MM) + column * (cardWidth + cardGap);
      const top = mmToPixels(GRID_TOP_MM) + row * (cardHeight + cardGap);
      const content = contents[itemIndex];
      const contentLeft = left + cardPadding;
      const contentWidth = cardWidth - cardPadding * 2;
      const sizeLayout = getBarcodeTableSizeLayout();
      setFont(context, 2.1, 800);
      const preferredVariantFontSize = mmToPixels(BARCODE_TABLE_COLOR_FONT_SIZE_MM);
      const variantLineHeight = mmToPixels(2.7);
      const variantColumns = getBarcodeTableVariantColumns(content.variantParts);
      const variantColorLayout = fitVariantTextToSingleLine({
        text: variantColumns.color,
        maxWidth: contentWidth,
        preferredFontSize: preferredVariantFontSize,
        preferredLineHeight: variantLineHeight,
        measureAtPreferredSize: (value) => context.measureText(value).width,
      });
      const variantPriceGap = mmToPixels(BARCODE_TABLE_VARIANT_PRICE_GAP_MM);
      const imageHeight = baseImageHeight - variantPriceGap;

      context.fillStyle = "#ffffff";
      context.fillRect(left, top, cardWidth, cardHeight);
      context.strokeStyle = "#111111";
      context.lineWidth = Math.max(1, mmToPixels(0.42));
      context.strokeRect(left, top, cardWidth, cardHeight);

      const imageLeft = left + cardPadding;
      const imageTop = top + cardPadding;
      const imageWidth = cardWidth - cardPadding * 2;
      const sizeTagSlotHeight = sizeLayout === "image-footer" && variantColumns.size
        ? mmToPixels(6)
        : 0;
      const productImageHeight = imageHeight - sizeTagSlotHeight;
      const image = decodedImages[itemIndex];
      if (image) {
        drawContainedImage(context, image, imageLeft, imageTop, imageWidth, productImageHeight);
      } else {
        drawImagePlaceholder(context, imageLeft, imageTop, imageWidth, productImageHeight);
      }
      context.strokeStyle = "#111111";
      context.lineWidth = Math.max(1, mmToPixels(0.2));
      context.strokeRect(imageLeft, imageTop, imageWidth, imageHeight);

      const badgeWidth = mmToPixels(8.5);
      const badgeHeight = mmToPixels(6.5);
      const badgeLeft = imageLeft;
      const badgeTop = imageTop;
      context.strokeStyle = "#111111";
      context.lineWidth = Math.max(1, mmToPixels(0.22));
      context.strokeRect(badgeLeft, badgeTop, badgeWidth, badgeHeight);
      setFont(context, 2.8, 700);
      context.fillStyle = "#111111";
      drawCenteredText(
        context,
        `#${String(startIndex + itemIndex + 1).padStart(2, "0")}`,
        badgeLeft,
        badgeTop,
        badgeWidth,
        badgeHeight,
      );
      if (sizeLayout === "image-footer") {
        drawSizeFooterBand(context, variantColumns.size, imageLeft, imageTop, imageWidth, imageHeight);
      } else if (sizeLayout === "corner-badge") {
        drawSizeCornerBadge(context, variantColumns.size, left, top, cardWidth);
      } else if (sizeLayout === "editorial-rail") {
        drawSizeEditorialRail(
          context,
          variantColumns.size,
          imageLeft,
          imageTop,
          imageWidth,
          imageHeight,
        );
      } else if (sizeLayout === "image-corner-box") {
        drawSizeImageCornerBox(
          context,
          variantColumns.size,
          imageLeft,
          imageTop,
          imageWidth,
          imageHeight,
        );
      }

      const brandTop = imageTop + imageHeight + mmToPixels(0.6);
      const metadataBaseline = brandTop + mmToPixels(1.25);
      const metadataSizeText = sizeLayout === "metadata-row"
        ? formatBarcodeTableSizeTag(variantColumns.size)
        : "";
      let metadataWidth = contentWidth;
      if (metadataSizeText) {
        const metadataGap = mmToPixels(1.5);
        const maxSizeWidth = mmToPixels(18);
        setFont(context, 1.75, 800);
        const sizeWidth = Math.min(maxSizeWidth, context.measureText(metadataSizeText).width);
        metadataWidth = Math.max(1, contentWidth - sizeWidth - metadataGap);
        context.fillStyle = "#111111";
        context.textAlign = "right";
        context.textBaseline = "middle";
        context.fillText(
          truncateText(context, metadataSizeText, maxSizeWidth),
          contentLeft + contentWidth,
          metadataBaseline,
        );
      }
      setFont(context, 1.7, 700);
      context.fillStyle = "#585858";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(
        truncateText(
          context,
          formatBarcodeTableMetadata(content.brand, content.productNumber),
          metadataWidth,
        ),
        contentLeft,
        metadataBaseline,
      );

      const productNameTop = brandTop + mmToPixels(
        2.3 + BARCODE_TABLE_BRAND_PRODUCT_GAP_MM,
      );
      setFont(context, 2.45, 800);
      context.fillStyle = "#111111";
      drawProductName(
        context,
        content.productName,
        contentLeft,
        productNameTop,
        contentWidth,
        mmToPixels(6.4),
      );

      const variantTop = productNameTop + mmToPixels(
        6.2 + BARCODE_TABLE_PRODUCT_COLOR_GAP_MM,
      );
      const variantCenterY = calculateVariantCenterY(variantTop, variantLineHeight);
      context.font = `${BARCODE_TABLE_COLOR_FONT_WEIGHT} ${variantColorLayout.fontSize}px ${LABEL_FONT_FAMILY}`;
      context.fillStyle = BARCODE_TABLE_COLOR_TEXT_COLOR;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(
        variantColorLayout.text,
        contentLeft,
        variantCenterY,
      );

      const priceTop = variantTop
        + mmToPixels(2.8)
        + variantPriceGap;
      setFont(context, 2.8, 800);
      context.fillStyle = "#111111";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(
        truncateText(context, `PRICE / ${content.price}`, contentWidth),
        contentLeft,
        priceTop + mmToPixels(2.1),
      );

      const barcodeValueTop = top
        + cardHeight
        - mmToPixels(CARD_BARCODE_BOTTOM_PADDING_MM)
        - barcodeValueHeight;
      const barcodeAreaTop = barcodeValueTop - barcodeAreaHeight;
      const barcode = barcodes[itemIndex];
      context.fillStyle = "#ffffff";
      context.fillRect(
        left + mmToPixels(1),
        barcodeAreaTop,
        cardWidth - mmToPixels(2),
        barcodeAreaHeight + barcodeValueHeight,
      );
      context.strokeStyle = "#111111";
      context.lineWidth = Math.max(1, mmToPixels(0.2));
      context.beginPath();
      context.moveTo(left + mmToPixels(1), barcodeAreaTop);
      context.lineTo(left + cardWidth - mmToPixels(1), barcodeAreaTop);
      context.stroke();
      const barcodeX = left + (cardWidth - barcode.width) / 2;
      const barcodeY = barcodeAreaTop
        + barcodeAreaHeight
        - barcode.height
        - mmToPixels(CARD_BARCODE_VALUE_GAP_MM);
      context.imageSmoothingEnabled = false;
      context.drawImage(barcode, Math.round(barcodeX), Math.round(barcodeY));

      setFont(context, 1.85, 600);
      context.fillStyle = "#111111";
      drawCenteredText(
        context,
        formatBarcodeTableCodeValue(content.barcodeValue, content.barcode),
        contentLeft,
        barcodeValueTop,
        contentWidth,
        barcodeValueHeight,
      );
    });
  } finally {
    decodedImages.forEach((image) => image?.dispose());
  }

  return canvas;
}

export async function generateBarcodeTablePdf(
  entries: BarcodeTableEntry[],
  elements: LabelElement[],
  title = "バーコード一覧",
): Promise<Uint8Array> {
  const printableEntries = getBarcodeTableEntries(entries);
  if (printableEntries.length === 0) {
    throw new Error("バーコード一覧に載せる商品を1件以上選択してください。");
  }

  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const normalizedTitle = normalizeSingleLineText(title).trim() || "バーコード一覧";
  pdf.setTitle(normalizedTitle);
  pdf.setCreator("LABEL PRINT");
  const pageSize = createBarcodeTablePageSize();
  const totalPages = calculateBarcodeTablePageCount(printableEntries);

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const startIndex = pageIndex * BARCODE_TABLE_ITEMS_PER_PAGE;
    const pageEntries = printableEntries.slice(startIndex, startIndex + BARCODE_TABLE_ITEMS_PER_PAGE);
    const canvas = await renderBarcodeTablePage(
      pageEntries,
      elements,
      normalizedTitle,
      pageIndex + 1,
      totalPages,
      printableEntries.length,
      startIndex,
    );
    const image = await pdf.embedPng(canvas.toDataURL("image/png"));
    const page = pdf.addPage(pageSize);
    page.drawImage(image, { x: 0, y: 0, width: pageSize[0], height: pageSize[1] });
    canvas.width = 1;
    canvas.height = 1;
  }

  return pdf.save();
}
