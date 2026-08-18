import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { searchRows } from "../lib/csv/searchRows";
import type { CsvRow, RowState } from "../types/csv";
import type { FieldMapping } from "../types/mapping";
import { ChevronIcon } from "./Icons";
import { ProductGridRow, type ProductColumn } from "./ProductGridRow";
import { SearchBar } from "./SearchBar";

const PAGE_SIZE = 10;

type ProductGridProps = {
  rows: CsvRow[];
  rowStates: RowState[];
  mapping: FieldMapping;
  activeRowIndex: number;
  onActivate: (index: number) => void;
  onSelectedChange: (index: number, selected: boolean) => void;
  onCopiesChange: (index: number, copies: number) => void;
  onToggleMany: (indices: number[], selected: boolean) => void;
};

export function createProductColumns(mapping: FieldMapping): ProductColumn[] {
  return [
    mapping.barcode && { key: "barcode", label: "バーコード", field: mapping.barcode },
    mapping.productName && { key: "productName", label: "商品名", field: mapping.productName },
    mapping.brand && { key: "brand", label: "ブランド", field: mapping.brand },
    mapping.color && { key: "color", label: "カラー", field: mapping.color },
    mapping.size && { key: "size", label: "サイズ", field: mapping.size },
    mapping.price && { key: "price", label: "価格", field: mapping.price, kind: "price" as const },
  ].filter((column): column is ProductColumn => Boolean(column));
}

export function ProductGrid({
  rows,
  rowStates,
  mapping,
  activeRowIndex,
  onActivate,
  onSelectedChange,
  onCopiesChange,
  onToggleMany,
}: ProductGridProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const columns = useMemo<ProductColumn[]>(
    () => createProductColumns(mapping),
    [mapping],
  );

  const filtered = useMemo(() => searchRows(rows, query), [query, rows]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => setPage(1), [query]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allFilteredSelected = filtered.length > 0 && filtered.every(({ index }) => rowStates[index]?.selected);
  const template = [
    "38px",
    ...columns.map((column) => column.key === "productName" ? "minmax(180px, 1.5fr)" : "minmax(110px, 1fr)"),
    "84px",
  ].join(" ");
  const first = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, filtered.length);

  return (
    <section className="product-panel" aria-label="商品データ">
      <div className="product-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <span>{filtered.length} 件</span>
      </div>
      <div className="product-grid-scroll" role="grid" aria-label="商品一覧">
        <div className="product-grid-row header-row" style={{ "--product-columns": template } as CSSProperties} role="row">
          <div role="columnheader" className="checkbox-cell">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              aria-label="検索結果をすべて選択"
              onChange={(event) => onToggleMany(filtered.map(({ index }) => index), event.target.checked)}
            />
          </div>
          {columns.map((column) => <div role="columnheader" key={column.key}>{column.label}</div>)}
          <div role="columnheader">枚数</div>
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
