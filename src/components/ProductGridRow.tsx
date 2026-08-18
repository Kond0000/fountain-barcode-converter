import type { CSSProperties, MouseEvent } from "react";
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
};

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
}: ProductGridRowProps) {
  const stop = (event: MouseEvent) => event.stopPropagation();
  const rowName = row[columns[0]?.field] || String(index + 1);
  return (
    <div
      className={`product-grid-row data-row ${state.selected ? "is-selected" : ""} ${active ? "is-active" : ""}`}
      style={{ "--product-columns": template } as CSSProperties}
      role="row"
      onClick={() => onActivate(index)}
    >
      <div role="gridcell" className="checkbox-cell" onClick={stop}>
        <input
          type="checkbox"
          checked={state.selected}
          aria-label={`${rowName}を印刷対象にする`}
          onChange={(event) => onSelectedChange(index, event.target.checked)}
        />
      </div>
      {columns.map((column) => {
        const raw = row[column.field] ?? "";
        const content = column.kind === "price"
          ? formatPrice(raw)
          : column.key === "color" || column.key === "size"
            ? formatVariantValue(raw)
            : raw || "—";
        return (
          <div role="gridcell" className="data-cell" title={raw} key={column.key}>
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
