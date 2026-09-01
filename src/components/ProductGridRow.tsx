import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from "react";
import type { CsvRow, RowState } from "../types/csv";
import { formatPrice } from "../lib/format";
import { formatVariantValue } from "../lib/label/formatVariant";

export type ProductColumn = { key: string; label: string; field: string; kind?: "price" };

const PDF_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function getAcceptedPdfImage(files: ArrayLike<File>): File | undefined {
  return Array.from(files).find((file) => PDF_IMAGE_TYPES.has(file.type));
}

export function shouldActivateProductRow(selectionText: string | null | undefined): boolean {
  return !selectionText?.trim();
}

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
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(undefined);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const acceptImage = (files: ArrayLike<File>) => {
    const image = getAcceptedPdfImage(files);
    if (image) onChange(image);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setDragging(false);
  };

  return (
    <div
      role="gridcell"
      className={`pdf-image-cell ${dragging ? "is-dragging" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={handleDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDragging(false);
        acceptImage(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label={`${rowName}の一覧PDF画像を選択`}
        onChange={(event) => {
          acceptImage(event.target.files ?? []);
          event.target.value = "";
        }}
      />
      <button
        className={`pdf-image-select ${file ? "has-image" : ""} ${dragging ? "is-dragging" : ""}`}
        type="button"
        title={file ? `${file.name}を変更（ドラッグ＆ドロップもできます）` : "一覧PDFへ載せる画像を選択、またはドラッグ＆ドロップ"}
        onClick={() => inputRef.current?.click()}
      >
        {dragging ? <span>ここに画像をドロップ</span> : previewUrl ? <img src={previewUrl} alt="" /> : <span>{file ? file.name : "画像を追加"}</span>}
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
      onClick={() => {
        if (shouldActivateProductRow(window.getSelection()?.toString())) onActivate(index);
      }}
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
      <PdfImagePicker
        file={state.pdfImage}
        rowName={rowName}
        onChange={(file) => onPdfImageChange(index, file)}
      />
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
            className={`data-cell is-copyable product-column-${column.key} ${column.key === "color" ? "product-color-cell" : ""}`}
            title={raw}
            key={column.key}
          >
            {content}
          </div>
        );
      })}
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
