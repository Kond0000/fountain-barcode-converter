import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createCode128CanvasForPrinter } from "../lib/barcode/generateCode128";
import { formatPrice } from "../lib/format";
import { LABEL_FONT_FAMILY } from "../lib/label/fitText";
import { formatVariantValue } from "../lib/label/formatVariant";
import { shouldStackDetailsRow } from "../lib/label/layoutDetailsRow";
import { layoutProductName } from "../lib/label/layoutProductName";
import type { CsvRow } from "../types/csv";
import {
  calculateHorizontalMargin,
  LABEL_LAYOUT_MM,
  PRODUCT_NAME_MAX_CHARACTERS_PER_LINE,
  type LabelSettings,
} from "../types/label";
import type { FieldMapping } from "../types/mapping";

type LabelVisualProps = {
  row: CsvRow;
  mapping: FieldMapping;
  settings: LabelSettings;
  maxWidthPx?: number;
  onHeightChange?: (heightMm: number) => void;
};

const PREVIEW_PIXELS_PER_MM = 4.5;

export function LabelVisual({ row, mapping, settings, maxWidthPx = 330, onHeightChange }: LabelVisualProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [barcodeDisplaySize, setBarcodeDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const barcodeValue = mapping.barcode ? row[mapping.barcode] ?? "" : "";
  const brand = mapping.brand ? row[mapping.brand] ?? "" : "";
  const productName = mapping.productName ? row[mapping.productName] ?? "" : "";
  const price = mapping.price ? formatPrice(row[mapping.price] ?? "") : "";
  const color = mapping.color ? formatVariantValue(row[mapping.color]) : "";
  const size = mapping.size ? formatVariantValue(row[mapping.size]) : "";
  const variant = [color, size].filter(Boolean).join(" / ");

  const safeWidth = Number.isFinite(settings.widthMm) ? Math.max(settings.widthMm, 0) : 0;
  const safeVerticalMargin = Number.isFinite(settings.marginMm) ? Math.max(settings.marginMm, 0) : 0;
  const safeHorizontalMargin = calculateHorizontalMargin(safeVerticalMargin);
  const previewWidth = Math.min(Math.max(safeWidth * PREVIEW_PIXELS_PER_MM, 120), maxWidthPx);
  const previewScale = safeWidth > 0 ? previewWidth / safeWidth : PREVIEW_PIXELS_PER_MM;
  const verticalPaddingPx = safeVerticalMargin * previewScale;
  const horizontalPaddingPx = safeHorizontalMargin * previewScale;
  const previewContentWidth = Math.max(
    (safeWidth - safeHorizontalMargin * 2) * previewScale - 2,
    1,
  );
  const previewBarcodeMaxWidth = previewContentWidth;
  const previewBarcodeHeight = LABEL_LAYOUT_MM.barcodeHeight * previewScale;
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
  const detailsStacked = shouldStackDetailsRow({ variant, price });

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !barcodeValue) {
      setBarcodeDisplaySize(null);
      setBarcodeError(barcodeValue ? "" : "バーコード値がありません");
      return () => { cancelled = true; };
    }

    const pixelRatio = Math.max(window.devicePixelRatio || 1, 1);
    void createCode128CanvasForPrinter(barcodeValue, {
      maxWidthPx: Math.max(Math.floor(previewBarcodeMaxWidth * pixelRatio), 1),
      targetHeightPx: Math.max(Math.round(previewBarcodeHeight * pixelRatio), 1),
      renderDpi: previewScale * 25.4 * pixelRatio,
    })
      .then((renderedCanvas) => {
        if (cancelled) return;
        canvas.width = renderedCanvas.width;
        canvas.height = renderedCanvas.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("バーコードを表示できません");
        context.imageSmoothingEnabled = false;
        context.drawImage(renderedCanvas, 0, 0);
        setBarcodeDisplaySize({
          width: renderedCanvas.width / pixelRatio,
          height: renderedCanvas.height / pixelRatio,
        });
        setBarcodeError("");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setBarcodeDisplaySize(null);
          setBarcodeError(error instanceof Error ? error.message : "バーコードを表示できません");
        }
      });
    return () => { cancelled = true; };
  }, [barcodeValue, previewBarcodeHeight, previewBarcodeMaxWidth, previewScale]);

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
        maxWidth: "100%",
        padding: `${verticalPaddingPx}px ${horizontalPaddingPx}px`,
        width: `${previewWidth}px`,
      }}
    >
      {productName || variant || price ? (
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
          {variant || price ? (
            <span
              className={`preview-details-row ${detailsStacked ? "is-stacked" : ""}`}
              style={{
                columnGap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px`,
                rowGap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px`,
              }}
            >
              {variant ? (
                <span className="preview-variant-container" style={textStyle(LABEL_LAYOUT_MM.variant.fontSize, LABEL_LAYOUT_MM.variant.lineHeight)}>
                  {variant}
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
        <canvas
          ref={canvasRef}
          className={`preview-barcode ${barcodeError ? "has-error" : ""}`}
          style={barcodeDisplaySize
            ? { width: `${barcodeDisplaySize.width}px`, height: `${barcodeDisplaySize.height}px` }
            : { height: `${previewBarcodeHeight}px` }}
          aria-label={`CODE128 ${barcodeValue}`}
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
