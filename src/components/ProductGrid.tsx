import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { searchRows, type IndexedCsvRow } from "../lib/csv/searchRows";
import type { CsvRow, RowState } from "../types/csv";
import type { FieldMapping } from "../types/mapping";
import { ChevronIcon, SortIcon } from "./Icons";
import { ProductGridRow, type ProductColumn } from "./ProductGridRow";
import { SearchBar } from "./SearchBar";

export const PRODUCT_GRID_PAGE_SIZE = 100;

export type ProductSort = { key: string; direction: "ascending" | "descending" };

const productCollator = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

export function getNextProductSort(current: ProductSort | undefined, key: string): ProductSort {
  return {
    key,
    direction: current?.key === key && current.direction === "ascending" ? "descending" : "ascending",
  };
}

function parseSortPrice(value: string): number | undefined {
  const normalized = value.replace(/^[¥$€£]\s*|\s*円$/g, "").replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}

export function sortProductRows(
  rows: IndexedCsvRow[],
  sort: ProductSort | undefined,
  columns: ProductColumn[],
  rowStates: RowState[],
): IndexedCsvRow[] {
  if (!sort) return rows;
  const direction = sort.direction === "ascending" ? 1 : -1;
  if (sort.key === "copies") {
    return [...rows].sort((left, right) =>
      ((rowStates[left.index]?.copies ?? 1) - (rowStates[right.index]?.copies ?? 1)) * direction
        || left.index - right.index,
    );
  }
  const column = columns.find(({ key }) => key === sort.key);
  if (!column) return rows;

  return [...rows].sort((left, right) => {
    const leftValue = (left.row[column.field] ?? "").normalize("NFKC").trim();
    const rightValue = (right.row[column.field] ?? "").normalize("NFKC").trim();
    // Keep empty cells at the end in either direction.
    if (!leftValue || !rightValue) {
      return Number(!leftValue) - Number(!rightValue) || left.index - right.index;
    }

    if (column.kind === "price") {
      const leftPrice = parseSortPrice(leftValue);
      const rightPrice = parseSortPrice(rightValue);
      if (leftPrice !== undefined && rightPrice !== undefined) {
        return (leftPrice - rightPrice) * direction || left.index - right.index;
      }
      if (leftPrice !== undefined || rightPrice !== undefined) {
        return leftPrice !== undefined ? -1 : 1;
      }
    }

    return productCollator.compare(leftValue, rightValue) * direction || left.index - right.index;
  });
}

type SortableColumnHeaderProps = {
  columnKey: string;
  label: string;
  className?: string;
  sort: ProductSort | undefined;
  onSort: (key: string) => void;
};

function SortableColumnHeader({ columnKey, label, className = "", sort, onSort }: SortableColumnHeaderProps) {
  const direction = sort?.key === columnKey ? sort.direction : undefined;
  const nextDirection = direction === "ascending" ? "降順" : "昇順";
  const actionLabel = `${label}を${nextDirection}に並び替え`;
  return (
    <div role="columnheader" aria-sort={direction ?? "none"} className={`sortable-column ${className}`}>
      <button
        type="button"
        className={`column-sort-button ${direction ? "is-sorted" : ""}`}
        aria-label={actionLabel}
        title={actionLabel}
        onClick={() => onSort(columnKey)}
      >
        <span>{label}</span>
        <SortIcon direction={direction} />
      </button>
    </div>
  );
}

export function getProductPage(
  rows: IndexedCsvRow[],
  page: number,
  pageSize = PRODUCT_GRID_PAGE_SIZE,
): IndexedCsvRow[] {
  const safePage = Math.max(1, Math.floor(page));
  const start = (safePage - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function getProductCodeThroughColor(
  row: CsvRow,
  barcodeField: string,
  sizeField: string | undefined,
): string {
  const barcode = row[barcodeField]?.trim() ?? "";
  const size = sizeField ? row[sizeField]?.trim() : "";
  if (!barcode) return "";
  if (!size) return `exact:${barcode}`;

  const sizeSuffix = `-${size}`;
  return barcode.endsWith(sizeSuffix)
    ? `through-color:${barcode.slice(0, -sizeSuffix.length)}`
    : `exact:${barcode}`;
}

export function getMatchingPdfImageIndices(
  rows: CsvRow[],
  mapping: Pick<FieldMapping, "barcode" | "productNumber" | "color" | "size">,
  sourceIndex: number,
): number[] {
  const sourceRow = rows[sourceIndex];
  if (!sourceRow) return [sourceIndex];

  const sourceProductNumber = mapping.productNumber
    ? sourceRow[mapping.productNumber]?.trim() ?? ""
    : "";
  const sourceColor = mapping.color
    ? sourceRow[mapping.color]?.trim() ?? ""
    : "";

  if (sourceProductNumber && sourceColor && mapping.productNumber && mapping.color) {
    return rows.flatMap((row, index) => {
      const productNumber = row[mapping.productNumber!]?.trim() ?? "";
      const color = row[mapping.color!]?.trim() ?? "";
      return productNumber === sourceProductNumber && color === sourceColor ? [index] : [];
    });
  }

  if (!mapping.barcode) return [sourceIndex];

  const sourceCode = getProductCodeThroughColor(sourceRow, mapping.barcode, mapping.size);
  if (!sourceCode) return [sourceIndex];

  return rows.flatMap((row, index) =>
    getProductCodeThroughColor(row, mapping.barcode!, mapping.size) === sourceCode ? [index] : [],
  );
}

type ProductGridProps = {
  rows: CsvRow[];
  rowStates: RowState[];
  mapping: FieldMapping;
  activeRowIndex: number;
  onActivate: (index: number) => void;
  onSelectedChange: (index: number, selected: boolean) => void;
  onCopiesChange: (index: number, copies: number) => void;
  onPdfImageChange: (index: number, file?: File) => void;
  onToggleMany: (indices: number[], selected: boolean) => void;
};

export function createProductColumns(mapping: FieldMapping): ProductColumn[] {
  return [
    mapping.barcode && { key: "barcode", label: "バーコード", field: mapping.barcode },
    mapping.productNumber && { key: "productNumber", label: "型番", field: mapping.productNumber },
    mapping.productName && { key: "productName", label: "商品名", field: mapping.productName },
    mapping.brand && { key: "brand", label: "ブランド", field: mapping.brand },
    mapping.color && { key: "color", label: "カラー", field: mapping.color },
    mapping.size && { key: "size", label: "サイズ", field: mapping.size },
    mapping.price && { key: "price", label: "価格", field: mapping.price, kind: "price" as const },
  ].filter((column): column is ProductColumn => Boolean(column));
}

export function createProductGridTemplate(columns: ProductColumn[]): string {
  const flexibleTracks: Record<string, string> = {
    barcode: "minmax(max-content, 1.1fr)",
    productNumber: "minmax(max-content, 1fr)",
    productName: "minmax(max-content, 1.8fr)",
    brand: "minmax(max-content, 1fr)",
    color: "minmax(max-content, 1fr)",
  };
  return [
    "38px",
    "112px",
    ...columns.map(({ key }) => flexibleTracks[key] ?? "max-content"),
    "72px",
  ].join(" ");
}

export function ProductGrid({
  rows,
  rowStates,
  mapping,
  activeRowIndex,
  onActivate,
  onSelectedChange,
  onCopiesChange,
  onPdfImageChange,
  onToggleMany,
}: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<ProductSort>();
  const selectPageCheckboxRef = useRef<HTMLInputElement>(null);
  const columns = useMemo<ProductColumn[]>(
    () => createProductColumns(mapping),
    [mapping],
  );

  const filtered = useMemo(() => searchRows(rows, query), [query, rows]);
  const sorted = useMemo(() => sortProductRows(filtered, sort, columns, rowStates), [filtered, sort, columns, rowStates]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PRODUCT_GRID_PAGE_SIZE));
  useEffect(() => setPage(1), [query]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);
  useEffect(() => {
    setSort(undefined);
    setPage(1);
  }, [rows]);

  const handleSort = (key: string) => {
    setSort((current) => getNextProductSort(current, key));
    setPage(1);
  };

  const visible = getProductPage(sorted, page);
  const visibleIndices = visible.map(({ index }) => index);
  const selectedVisibleCount = visible.reduce(
    (count, { index }) => count + (rowStates[index]?.selected ? 1 : 0),
    0,
  );
  const allVisibleSelected = visible.length > 0 && selectedVisibleCount === visible.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
  useEffect(() => {
    if (selectPageCheckboxRef.current) {
      selectPageCheckboxRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);
  const template = createProductGridTemplate(columns);
  const first = filtered.length === 0 ? 0 : (page - 1) * PRODUCT_GRID_PAGE_SIZE + 1;
  const last = Math.min(page * PRODUCT_GRID_PAGE_SIZE, filtered.length);

  return (
    <section className="product-panel" aria-label="商品データ">
      <div className="product-toolbar">
        <div className="product-toolbar-heading">
          <strong>印刷する商品</strong>
          <span>{filtered.length} 件</span>
        </div>
        <SearchBar value={query} onChange={setQuery} />
      </div>
      <div
        className="product-grid-scroll"
        style={{ "--product-columns": template } as CSSProperties}
        role="grid"
        aria-label="商品一覧"
      >
        <div className="product-grid-row header-row" style={{ "--product-columns": template } as CSSProperties} role="row">
          <div role="columnheader" className="checkbox-cell">
            <input
              ref={selectPageCheckboxRef}
              type="checkbox"
              checked={allVisibleSelected}
              aria-label="このページの表示商品をすべて選択"
              title="このページの表示商品をすべて選択"
              onChange={(event) => onToggleMany(visibleIndices, event.target.checked)}
            />
          </div>
          <div role="columnheader" className="pdf-image-cell">一覧PDF画像</div>
          {columns.map((column) => (
            <SortableColumnHeader
              columnKey={column.key}
              label={column.label}
              className={`product-column-${column.key}`}
              key={column.key}
              sort={sort}
              onSort={handleSort}
            />
          ))}
          <SortableColumnHeader columnKey="copies" label="枚数" sort={sort} onSort={handleSort} />
        </div>
        {visible.length > 0 ? visible.map(({ row, index }) => (
          <ProductGridRow
            key={index}
            row={row}
            index={index}
            state={rowStates[index]}
            columns={columns}
            template={template}
            active={activeRowIndex === index}
            onActivate={onActivate}
            onSelectedChange={onSelectedChange}
            onCopiesChange={onCopiesChange}
            onPdfImageChange={onPdfImageChange}
          />
        )) : <div className="empty-results">該当する商品がありません。</div>}
      </div>
      <div className="pagination">
        <span>{first}–{last} / {filtered.length} 行</span>
        <div className="pagination-controls">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} aria-label="前のページ">
            <ChevronIcon className="chevron-left" />
          </button>
          <strong>{page}</strong>
          <span>/ {pageCount}</span>
          <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount} aria-label="次のページ">
            <ChevronIcon />
          </button>
        </div>
      </div>
    </section>
  );
}
