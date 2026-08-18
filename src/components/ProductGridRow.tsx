import type { CSSProperties, MouseEvent } from "react";
import type { CsvRow, RowState } from "../types/csv";
import { formatPrice } from "../lib/format";
import type { ProductColumn } from "../lib/csv/productColumns";

type ProductGridRowProps = {
  row: CsvRow;
  index: number;
  rowLabel: string;
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
  rowLabel,
  state,
  columns,
  template,
  active,
  onActivate,
  onSelectedChange,
  onCopiesChange,
}: ProductGridRowProps) {
  const stop = (event: MouseEvent) => event.stopPropagation();
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
          aria-label={`${rowLabel}を印刷対象にする`}
          onChange={(event) => onSelectedChange(index, event.target.checked)}
        />
      </div>
      {columns.map((column) => {
        const raw = row[column.field] ?? "";
        return (
          <div role="gridcell" className="data-cell" title={raw} key={column.key}>
            {column.kind === "price" ? formatPrice(raw) : raw || "—"}
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
          aria-label={`${rowLabel}の印刷枚数`}
          onChange={(event) => onCopiesChange(index, Number(event.target.value))}
        />
      </div>
    </div>
  );
}
