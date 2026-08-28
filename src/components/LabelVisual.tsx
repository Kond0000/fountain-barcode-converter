import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createCode128CanvasForPrinter } from "../lib/barcode/generateCode128";
import { formatPrice } from "../lib/format";
import { LABEL_FONT_FAMILY } from "../lib/label/fitText";
import { formatVariantValue } from "../lib/label/formatVariant";
import { formatProductNumber } from "../lib/label/formatProductNumber";
import { shouldStackDetailsRow } from "../lib/label/layoutDetailsRow";
import { layoutProductName } from "../lib/label/layoutProductName";
import {
  calculateVariantColorMaxWidth,
  fitVariantTextToSingleLine,
  formatVariantText,
  getVariantColumns,
  VARIANT_SEPARATOR_GAP_MM,
} from "../lib/label/layoutVariant";
import {
  LABEL_RENDER_DPI,
  LABEL_RENDER_PIXELS_PER_MM,
  LABEL_RENDER_SCALE,
  mmToLabelRenderPixels,
} from "../lib/pdf/generateLabels";
import type { CsvRow } from "../types/csv";
import {
  calculateHorizontalMargin,
  LABEL_LAYOUT_MM,
  PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
  type LabelSettings,
} from "../types/label";
import type { FieldMapping } from "../types/mapping";
import { explainBarcodePreviewError } from "../lib/userFacingError";

type LabelVisualProps = {
  row: CsvRow;
  mapping: FieldMapping;
  settings: LabelSettings;
  maxWidthPx?: number;
  pixelsPerMm?: number;
  allowOverflow?: boolean;
  onHeightChange?: (heightMm: number) => void;
};

// The preview must leave at least roughly two CSS pixels for the narrowest
// bars and gaps of a typical printer-native CODE128 symbol.
const PREVIEW_PIXELS_PER_MM = 6;

export function LabelVisual({
  row,
  mapping,
  settings,
  maxWidthPx = 330,
  pixelsPerMm,
  allowOverflow = false,
  onHeightChange,
}: LabelVisualProps) {
  const labelRef = useRef<HTMLDivElement>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [barcodeImageSrc, setBarcodeImageSrc] = useState("");
  const [barcodeDisplaySize, setBarcodeDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const barcodeValue = mapping.barcode ? row[mapping.barcode] ?? "" : "";
  const productNumber = formatProductNumber(mapping.productNumber ? row[mapping.productNumber] : "");
  const brand = mapping.brand ? row[mapping.brand] ?? "" : "";
  const productName = mapping.productName ? row[mapping.productName] ?? "" : "";
  const price = mapping.price ? formatPrice(row[mapping.price] ?? "") : "";
  const color = mapping.color ? formatVariantValue(row[mapping.color]) : "";
  const size = mapping.size ? formatVariantValue(row[mapping.size]) : "";
  const variant = formatVariantText([color, size].filter(Boolean));
  const variantColumns = getVariantColumns([color, size]);

  const safeWidth = Number.isFinite(settings.widthMm) ? Math.max(settings.widthMm, 0) : 0;
  const safeVerticalMargin = Number.isFinite(settings.marginMm) ? Math.max(settings.marginMm, 0) : 0;
  const safeHorizontalMargin = calculateHorizontalMargin(safeVerticalMargin);
  const safePixelsPerMm = typeof pixelsPerMm === "number" && Number.isFinite(pixelsPerMm)
    ? Math.max(pixelsPerMm, 1)
    : PREVIEW_PIXELS_PER_MM;
  const previewWidth = Math.min(Math.max(safeWidth * safePixelsPerMm, 120), maxWidthPx);
  const previewScale = safeWidth > 0 ? previewWidth / safeWidth : safePixelsPerMm;
  const verticalPaddingPx = safeVerticalMargin * previewScale;
  const horizontalPaddingPx = safeHorizontalMargin * previewScale;
  const previewContentWidth = Math.max(
    (safeWidth - safeHorizontalMargin * 2) * previewScale - 2,
    1,
  );
  const previewBarcodeHeight = LABEL_LAYOUT_MM.barcodeHeight * previewScale;
  const barcodeRenderHorizontalMargin = mmToLabelRenderPixels(safeHorizontalMargin);
  const barcodeRenderMaxWidth = Math.max(
    mmToLabelRenderPixels(safeWidth) - barcodeRenderHorizontalMargin * 2,
    1,
  );
  const barcodeRenderHeight = mmToLabelRenderPixels(LABEL_LAYOUT_MM.barcodeHeight);
  const barcodeCssScale = previewScale / LABEL_RENDER_PIXELS_PER_MM;
  const productNameLayout = useMemo(() => {
    const preferredFontSize = LABEL_LAYOUT_MM.productName.fontSize * previewScale;
    const preferredLineHeight = LABEL_LAYOUT_MM.productName.lineHeight * previewScale;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        lines: [productName],
        fontSize: preferredFontSize,
        lineHeight: preferredLineHeight,
      };
    }
    return layoutProductName({
      text: productName,
      maxCharacters: PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
      maxWidth: previewContentWidth,
      preferredFontSize,
      preferredLineHeight,
      minFontSize: LABEL_LAYOUT_MM.productName.minFontSize * previewScale,
      measure: (value, fontSize) => {
        context.font = `${LABEL_LAYOUT_MM.productName.weight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
        return context.measureText(value).width;
      },
    });
  }, [previewContentWidth, previewScale, productName]);
  const variantLayout = useMemo(() => {
    const preferredFontSize = LABEL_LAYOUT_MM.variant.fontSize * previewScale;
    const preferredLineHeight = LABEL_LAYOUT_MM.variant.lineHeight * previewScale;
    const separatorBeforeGap = variantColumns.size ? VARIANT_SEPARATOR_GAP_MM * previewScale : 0;
    const separatorAfterGap = variantColumns.size ? VARIANT_SEPARATOR_GAP_MM * previewScale : 0;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        color: {
          text: variantColumns.color,
          fontSize: preferredFontSize,
          lineHeight: preferredLineHeight,
          shouldWrap: false,
        },
        separatorBeforeGap,
        separatorAfterGap,
        sizeColumnWidth: variantColumns.size ? 5.8 * previewScale : 0,
      };
    }
    context.font = `${LABEL_LAYOUT_MM.variant.weight} ${preferredFontSize}px ${LABEL_FONT_FAMILY}`;
    const sizeColumnWidth = variantColumns.size
      ? Math.max(context.measureText(variantColumns.size).width, 1)
      : 0;
    const colorColumnWidth = calculateVariantColorMaxWidth(
      previewContentWidth,
      sizeColumnWidth,
      separatorBeforeGap,
      separatorAfterGap,
    );
    return {
      color: fitVariantTextToSingleLine({
        text: variantColumns.color,
        maxWidth: colorColumnWidth,
        preferredFontSize,
        preferredLineHeight,
        measureAtPreferredSize: (value) => context.measureText(value).width,
      }),
      separatorBeforeGap,
      separatorAfterGap,
      sizeColumnWidth,
    };
  }, [previewContentWidth, previewScale, variantColumns.color, variantColumns.size]);
  const detailsStacked = shouldStackDetailsRow({ variant, price });

  useEffect(() => {
    let cancelled = false;
    if (!barcodeValue) {
      setBarcodeImageSrc("");
      setBarcodeDisplaySize(null);
      setBarcodeError("バーコードがありません。バーコード列と商品の値を確認してください。");
      return () => { cancelled = true; };
    }

    // Generate the same print-resolution barcode used by the PDF, then change
    // only its CSS display size for the preview. This keeps narrow preview cards
    // from becoming an artificial barcode-width constraint.
    void createCode128CanvasForPrinter(barcodeValue, {
      maxWidthPx: barcodeRenderMaxWidth,
      targetHeightPx: barcodeRenderHeight,
      renderDpi: LABEL_RENDER_DPI,
      moduleScaleStep: LABEL_RENDER_SCALE,
      externalQuietZonePx: barcodeRenderHorizontalMargin,
    })
      .then((renderedCanvas) => {
        if (cancelled) return;
        setBarcodeImageSrc(renderedCanvas.toDataURL("image/png"));
        setBarcodeDisplaySize({
          width: renderedCanvas.width * barcodeCssScale,
          height: renderedCanvas.height * barcodeCssScale,
        });
        setBarcodeError("");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBarcodeImageSrc("");
          setBarcodeDisplaySize(null);
          setBarcodeError(explainBarcodePreviewError(error));
        }
      });
    return () => { cancelled = true; };
  }, [
    barcodeCssScale,
    barcodeRenderHeight,
    barcodeRenderHorizontalMargin,
    barcodeRenderMaxWidth,
    barcodeValue,
  ]);

  useEffect(() => {
    if (!onHeightChange) return undefined;
    const label = labelRef.current;
    if (!label || safeWidth <= 0) {
      onHeightChange(0);
      return undefined;
    }
    const updateHeight = () => {
      const rect = label.getBoundingClientRect();
      if (rect.width > 0) onHeightChange(Math.round((rect.height * safeWidth / rect.width) * 10) / 10);
    };
    const observer = new ResizeObserver(updateHeight);
    observer.observe(label);
    updateHeight();
    return () => observer.disconnect();
  }, [onHeightChange, safeWidth]);

  const textStyle = (fontSizeMm: number, lineHeightMm: number): CSSProperties => ({
    fontSize: `${fontSizeMm * previewScale}px`,
    lineHeight: `${lineHeightMm * previewScale}px`,
  });

  return (
    <div
      ref={labelRef}
      className="physical-label"
      style={{
        gap: `${LABEL_LAYOUT_MM.sectionGap * previewScale}px`,
        maxWidth: allowOverflow ? "none" : "100%",
        padding: `${verticalPaddingPx}px ${horizontalPaddingPx}px`,
        width: `${previewWidth}px`,
      }}
    >
      {productName || productNumber || variant || price ? (
        <div
          className="preview-content-group preview-product-group"
          style={{ gap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px` }}
        >
          {productName ? (
            <strong
              className="preview-name"
              style={{
                fontFamily: LABEL_FONT_FAMILY,
                fontSize: `${productNameLayout.fontSize}px`,
                lineHeight: `${productNameLayout.lineHeight}px`,
              }}
            >
              {productNameLayout.lines.map((line, index) => (
                <span className="preview-name-line" key={`${line}-${index}`}>{line}</span>
              ))}
            </strong>
          ) : null}
          {productNumber ? (
            <span className="preview-product-number" style={textStyle(LABEL_LAYOUT_MM.productNumber.fontSize, LABEL_LAYOUT_MM.productNumber.lineHeight)}>
              {productNumber}
            </span>
          ) : null}
          {variant || price ? (
            <span
              className={`preview-details-row ${detailsStacked ? "is-stacked" : ""}`}
              style={{
                columnGap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px`,
                rowGap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px`,
              }}
            >
              {variant ? (
                <span
                  className="preview-variant-container"
                  style={{
                    ...textStyle(LABEL_LAYOUT_MM.variant.fontSize, LABEL_LAYOUT_MM.variant.lineHeight),
                    height: `${LABEL_LAYOUT_MM.variant.lineHeight * previewScale}px`,
                  }}
                >
                  <span className="preview-variant-color">
                    <span
                      className="preview-variant-line"
                      style={{
                        fontSize: `${variantLayout.color.fontSize}px`,
                        lineHeight: `${variantLayout.color.lineHeight}px`,
                      }}
                    >
                      {variantLayout.color.text}
                    </span>
                  </span>
                  {variantColumns.size ? (
                    <span
                      className="preview-variant-size"
                      style={{
                        marginLeft: `${variantLayout.separatorBeforeGap}px`,
                        paddingLeft: `${variantLayout.separatorAfterGap}px`,
                        width: `${variantLayout.separatorAfterGap + variantLayout.sizeColumnWidth}px`,
                      }}
                    >
                      {variantColumns.size}
                    </span>
                  ) : null}
                </span>
              ) : <span />}
              {price ? (
                <strong className="preview-price" style={textStyle(LABEL_LAYOUT_MM.price.fontSize, LABEL_LAYOUT_MM.price.lineHeight)}>{price}</strong>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
      <div
        className="preview-content-group preview-barcode-group"
        style={{ gap: `${LABEL_LAYOUT_MM.barcodeValueGap * previewScale}px` }}
      >
        <img
          className={`preview-barcode ${barcodeError ? "has-error" : ""}`}
          src={barcodeImageSrc || undefined}
          style={barcodeDisplaySize
            ? { width: `${barcodeDisplaySize.width}px`, height: `${barcodeDisplaySize.height}px` }
            : { height: `${previewBarcodeHeight}px` }}
          alt={`CODE128 ${barcodeValue}`}
        />
        {barcodeError ? <span className="preview-error">{barcodeError}</span> : null}
        {barcodeValue ? <span className="preview-code" style={textStyle(LABEL_LAYOUT_MM.barcodeValue.fontSize, LABEL_LAYOUT_MM.barcodeValue.lineHeight)}>{barcodeValue}</span> : null}
      </div>
      {brand ? (
        <div className="preview-content-group preview-brand-group">
          <span className="preview-brand" style={textStyle(LABEL_LAYOUT_MM.brand.fontSize, LABEL_LAYOUT_MM.brand.lineHeight)}>{brand}</span>
        </div>
      ) : null}
    </div>
  );
}
