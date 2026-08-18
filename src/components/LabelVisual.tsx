import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { generateCode128Canvas } from "../lib/barcode/generateCode128";
import { formatPrice } from "../lib/format";
import { fitTextToSingleLine, LABEL_FONT_FAMILY, normalizeSingleLineText } from "../lib/label/fitText";
import type { CsvRow } from "../types/csv";
import { calculateHorizontalMargin, LABEL_LAYOUT_MM, type LabelSettings } from "../types/label";
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
  const barcodeValue = mapping.barcode ? row[mapping.barcode] ?? "" : "";
  const brand = mapping.brand ? row[mapping.brand] ?? "" : "";
  const productName = mapping.productName ? row[mapping.productName] ?? "" : "";
  const price = mapping.price ? formatPrice(row[mapping.price] ?? "") : "";
  const variant = useMemo(
    () => [mapping.color, mapping.size]
      .map((field) => field ? row[field]?.trim() : "")
      .filter(Boolean)
      .join(" / "),
    [mapping.color, mapping.size, row],
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !barcodeValue) {
      setBarcodeError(barcodeValue ? "" : "バーコード値がありません");
      return () => { cancelled = true; };
    }
    void generateCode128Canvas(barcodeValue, canvas, { scale: 3, heightMm: 9 })
      .then(() => { if (!cancelled) setBarcodeError(""); })
      .catch((error: unknown) => {
        if (!cancelled) setBarcodeError(error instanceof Error ? error.message : "バーコードを表示できません");
      });
    return () => { cancelled = true; };
  }, [barcodeValue]);

  const safeWidth = Number.isFinite(settings.widthMm) ? Math.max(settings.widthMm, 0) : 0;
  const safeVerticalMargin = Number.isFinite(settings.marginMm) ? Math.max(settings.marginMm, 0) : 0;
  const safeHorizontalMargin = calculateHorizontalMargin(safeVerticalMargin);
  const previewWidth = Math.min(Math.max(safeWidth * PREVIEW_PIXELS_PER_MM, 120), maxWidthPx);
  const previewScale = safeWidth > 0 ? previewWidth / safeWidth : PREVIEW_PIXELS_PER_MM;
  const verticalPaddingPx = safeVerticalMargin * previewScale;
  const horizontalPaddingPx = safeHorizontalMargin * previewScale;
  const productNameText = normalizeSingleLineText(productName);
  const productNameLayout = useMemo(() => {
    const preferredFontSize = LABEL_LAYOUT_MM.productName.fontSize * previewScale;
    const preferredLineHeight = LABEL_LAYOUT_MM.productName.lineHeight * previewScale;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        text: productNameText,
        fontSize: preferredFontSize,
        lineHeight: preferredLineHeight,
        shouldWrap: true,
      };
    }
    context.font = `${LABEL_LAYOUT_MM.productName.weight} ${preferredFontSize}px ${LABEL_FONT_FAMILY}`;
    return fitTextToSingleLine({
      text: productNameText,
      maxWidth: Math.max((safeWidth - safeHorizontalMargin * 2) * previewScale - 2, 1),
      preferredFontSize,
      preferredLineHeight,
      minFontSize: LABEL_LAYOUT_MM.productName.minFontSize * previewScale,
      measureAtPreferredSize: (value) => context.measureText(value).width,
    });
  }, [previewScale, productNameText, safeHorizontalMargin, safeWidth]);

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
      {brand || productName || variant ? (
        <div
          className="preview-content-group preview-product-group"
          style={{ gap: `${LABEL_LAYOUT_MM.itemGap * previewScale}px` }}
        >
          {brand ? <span className="preview-brand" style={textStyle(LABEL_LAYOUT_MM.brand.fontSize, LABEL_LAYOUT_MM.brand.lineHeight)}>{brand}</span> : null}
          {productNameText ? (
            <strong
              className="preview-name"
              style={{
                fontFamily: LABEL_FONT_FAMILY,
                fontSize: `${productNameLayout.fontSize}px`,
                lineHeight: `${productNameLayout.lineHeight}px`,
                overflowWrap: productNameLayout.shouldWrap ? "anywhere" : "normal",
                whiteSpace: productNameLayout.shouldWrap ? "normal" : "nowrap",
              }}
            >
              {productNameLayout.text}
            </strong>
          ) : null}
          {variant ? <span className="preview-variant" style={textStyle(LABEL_LAYOUT_MM.variant.fontSize, LABEL_LAYOUT_MM.variant.lineHeight)}>{variant}</span> : null}
        </div>
      ) : null}
      {price ? (
        <div className="preview-content-group preview-price-group">
          <strong className="preview-price" style={textStyle(LABEL_LAYOUT_MM.price.fontSize, LABEL_LAYOUT_MM.price.lineHeight)}>{price}</strong>
        </div>
      ) : null}
      <div
        className="preview-content-group preview-barcode-group"
        style={{ gap: `${LABEL_LAYOUT_MM.barcodeValueGap * previewScale}px` }}
      >
        <canvas
          ref={canvasRef}
          className={`preview-barcode ${barcodeError ? "has-error" : ""}`}
          style={{ height: `${LABEL_LAYOUT_MM.barcodeHeight * previewScale}px` }}
          aria-label={`CODE128 ${barcodeValue}`}
        />
        {barcodeError ? <span className="preview-error">{barcodeError}</span> : null}
        {barcodeValue ? <span className="preview-code" style={textStyle(LABEL_LAYOUT_MM.barcodeValue.fontSize, LABEL_LAYOUT_MM.barcodeValue.lineHeight)}>{barcodeValue}</span> : null}
      </div>
    </div>
  );
}
