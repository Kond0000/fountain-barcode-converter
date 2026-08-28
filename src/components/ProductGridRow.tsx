import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import type { CsvRow, RowState } from "../types/csv";
import { formatPrice } from "../lib/format";
import { formatVariantValue } from "../lib/label/formatVariant";

export type ProductColumn = { key: string; label: string; field: string; kind?: "price" };

type ProductGridRowProps = {
  row: CsvRow;
  index: number;
  state: RowState;
  columns: ProductColumn[];
  template: string;
  active: boolean;
  onActivate: (index: number) => void;
  onSelectedChange: (index: number, selected: boolean) => void;
  onCopiesChange: (index: number, copies: number) => void;
  onPdfImageChange: (index: number, file?: File) => void;
};

type PdfImagePickerProps = {
  file?: File;
  rowName: string;
  onChange: (file?: File) => void;
};

function PdfImagePicker({ file, rowName, onChange }: PdfImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();

  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div role="gridcell" className="pdf-image-cell" onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`${rowName}の一覧PDF画像を選択`}
        onChange={(event) => {
          onChange(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <button
        className={`pdf-image-select ${file ? "has-image" : ""}`}
        type="button"
        title={file ? `${file.name}を変更` : "一覧PDFへ載せる画像を選択"}
        onClick={() => inputRef.current?.click()}
      >
        {previewUrl ? <img src={previewUrl} alt="" /> : <span>{file ? file.name : "画像を追加"}</span>}
      </button>
      {file ? (
        <button
          className="pdf-image-remove"
          type="button"
          aria-label={`${rowName}の一覧PDF画像を削除`}
          title="画像を削除"
          onClick={() => onChange(undefined)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function ProductGridRow({
  row,
  index,
  state,
  columns,
  template,
  active,
  onActivate,
  onSelectedChange,
  onCopiesChange,
  onPdfImageChange,
}: ProductGridRowProps) {
  const stop = (event: MouseEvent) => event.stopPropagation();
  const rowName = row[columns[0]?.field] || String(index + 1);
  return (
    <div
      className={`product-grid-row data-row ${state.selected ? "is-selected" : ""} ${active ? "is-active" : ""}`}
      style={{ "--product-columns": template } as CSSProperties}
      role="row"
      aria-current={active ? "true" : undefined}
      title={active ? "この商品をプレビュー中" : "クリックしてプレビュー"}
      onClick={() => onActivate(index)}
    >
      <div role="gridcell" className="checkbox-cell" onClick={stop}>
        <input
          type="checkbox"
          checked={state.selected}
          aria-label={`${rowName}を印刷対象にする`}
          onChange={(event) => onSelectedChange(index, event.target.checked)}
        />
        {active ? <span className="visually-hidden">プレビュー中</span> : null}
      </div>
      {columns.map((column) => {
        const raw = row[column.field] ?? "";
        const content = column.kind === "price"
          ? formatPrice(raw)
          : column.key === "color" || column.key === "size"
            ? formatVariantValue(raw)
            : raw || "—";
        return (
          <div
            role="gridcell"
            className={`data-cell product-column-${column.key} ${column.key === "color" ? "product-color-cell" : ""}`}
            title={raw}
            key={column.key}
          >
            {content}
          </div>
        );
      })}
      <PdfImagePicker
        file={state.pdfImage}
        rowName={rowName}
        onChange={(file) => onPdfImageChange(index, file)}
      />
      <div role="gridcell" className="copies-cell" onClick={stop}>
        <input
          type="number"
          min="1"
          max="999"
          step="1"
          value={state.copies}
          aria-label={`${rowName}の印刷枚数`}
          onChange={(event) => onCopiesChange(index, Number(event.target.value))}
        />
      </div>
    </div>
  );
}
