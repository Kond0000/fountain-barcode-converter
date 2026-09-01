import type { FieldMapping, MappingKey } from "../../types/mapping";

const candidates: Record<MappingKey, string[]> = {
  barcode: ["商品コード", "JAN", "JANコード", "SKU", "SKUコード", "品番", "Product Code", "Code"],
  productNumber: ["型番", "品番", "グループコード", "Style No", "Style Number", "Item Number"],
  productName: ["商品名", "名称", "商品名称", "Title", "Product Name", "Name"],
  price: ["商品単価", "販売価格", "価格", "税込価格", "Price"],
  color: ["カラー", "色", "Color", "Colour"],
  size: ["サイズ", "Size"],
  brand: ["ブランド名", "ブランド", "Brand", "メーカー"],
};

function caseFold(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja");
}

function loose(value: string): string {
  return caseFold(value).replace(/[\s_-]+/g, "");
}

function detectHeader(headers: string[], fieldCandidates: string[], used: Set<string>): string | undefined {
  for (const candidate of fieldCandidates) {
    const exact = headers.find((header) => header === candidate && !used.has(header));
    if (exact) return exact;
  }
  for (const candidate of fieldCandidates) {
    const folded = caseFold(candidate);
    const matched = headers.find((header) => caseFold(header) === folded && !used.has(header));
    if (matched) return matched;
  }
  for (const candidate of fieldCandidates) {
    const normalized = loose(candidate);
    const matched = headers.find((header) => loose(header) === normalized && !used.has(header));
    if (matched) return matched;
  }
  return undefined;
}

export function detectFields(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  const used = new Set<string>();
  (Object.keys(candidates) as MappingKey[]).forEach((key) => {
    const header = detectHeader(headers, candidates[key], used);
    if (header) {
      mapping[key] = header;
      used.add(header);
    }
  });
  return mapping;
}
