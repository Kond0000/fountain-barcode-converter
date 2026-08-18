import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createDefaultVisibleFields,
  createProductColumns,
  getMappedGridFields,
} from "../lib/csv/productColumns";
import { searchRows } from "../lib/csv/searchRows";
import type { CsvRow, RowState } from "../types/csv";
import type { FieldMapping } from "../types/mapping";
import { ChevronIcon } from "./Icons";
import { ProductGridRow } from "./ProductGridRow";
import { SearchBar } from "./SearchBar";

const PAGE_SIZE = 10;

type ProductGridProps = {
  rows: CsvRow[];
  headers: string[];
  rowStates: RowState[];
  mapping: FieldMapping;
  activeRowIndex: number;
  onActivate: (index: number) => void;
  onSelectedChange: (index: number, selected: boolean) => void;
  onCopiesChange: (index: number, copies: number) => void;
  onToggleMany: (indices: number[], selected: boolean) => void;
};

export function ProductGrid({
  rows,
  headers,
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
  const [visibleFields, setVisibleFields] = useState<Set<string>>(
    () => new Set(createDefaultVisibleFields(headers, mapping)),
  );
  const mappedFields = useMemo(
    () => getMappedGridFields(mapping),
    [mapping.barcode, mapping.brand, mapping.color, mapping.price, mapping.productName, mapping.size],
  );
  const columns = useMemo(
    () => createProductColumns(headers, mapping, visibleFields),
    [headers, mapping, visibleFields],
  );

  useEffect(() => {
    setVisibleFields(new Set(createDefaultVisibleFields(headers, mapping)));
  }, [headers]);

  useEffect(() => {
    setVisibleFields((current) => {
      const next = new Set(current);
      mappedFields.forEach((field) => next.add(field));
      return next;
    });
  }, [mappedFields]);

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
  const identityField = mapping.barcode || mapping.productName || headers[0];

  const setFieldVisible = (field: string, visibleField: boolean) => {
    setVisibleFields((current) => {
      const next = new Set(current);
      if (visibleField) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  return (
    <section className="product-panel" aria-label="商品データ">
      <div className="product-toolbar">
        <SearchBar value={query} onChange={setQuery} />
        <div className="product-toolbar-meta">
          <span>{filtered.length} 件</span>
          <details className="column-visibility">
            <summary>表示列 <strong>{columns.length}/{headers.length}</strong></summary>
            <div className="column-visibility-menu">
              <div className="column-visibility-heading">
                <strong>一覧に表示する列</strong>
                <span>選択と枚数は常に表示</span>
              </div>
              <div className="column-visibility-options" role="group" aria-label="商品一覧の表示列">
                {headers.map((header) => (
                  <label key={header} title={header}>
                    <input
                      type="checkbox"
                      checked={visibleFields.has(header)}
                      aria-label={`${header}を表示`}
                      onChange={(event) => setFieldVisible(header, event.target.checked)}
                    />
                    <span>{header}</span>
                  </label>
                ))}
              </div>
              <div className="column-visibility-actions">
                <button type="button" onClick={() => setVisibleFields(new Set(createDefaultVisibleFields(headers, mapping)))}>主要項目に戻す</button>
                <button type="button" onClick={() => setVisibleFields(new Set(headers))}>すべて表示</button>
              </div>
            </div>
          </details>
        </div>
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
            rowLabel={row[identityField] || String(index + 1)}
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
