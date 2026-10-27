import type { CsvRow, RowState } from "../../types/csv";
import type { FieldMapping } from "../../types/mapping";
import type { IndexedCsvRow } from "./searchRows";

export type ProductColumn = { key: string; label: string; field: string; kind?: "price" };

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

export function createSelectedProductEntries(
  rows: CsvRow[],
  rowStates: RowState[],
  mapping: FieldMapping,
  sort: ProductSort | undefined,
): { row: CsvRow; copies: number; imageFile?: File }[] {
  const indexed = rows.map((row, index) => ({ row, index }));
  return sortProductRows(indexed, sort, createProductColumns(mapping), rowStates).flatMap(({ row, index }) => {
    const state = rowStates[index];
    return state?.selected && state.copies > 0 ? [{ row, copies: state.copies, imageFile: state.pdfImage }] : [];
  });
}
