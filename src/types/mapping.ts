export type FieldMapping = {
  barcode?: string;
  productNumber?: string;
  productName?: string;
  price?: string;
  color?: string;
  size?: string;
  brand?: string;
  stock?: string;
};

export type MappingKey = keyof Pick<
  FieldMapping,
  "barcode" | "productNumber" | "productName" | "price" | "color" | "size" | "brand"
>;

export const mappingDefinitions: ReadonlyArray<{
  key: MappingKey;
  label: string;
  required?: boolean;
}> = [
  { key: "barcode", label: "バーコード", required: true },
  { key: "productNumber", label: "型番（グループコード）" },
  { key: "productName", label: "商品名" },
  { key: "price", label: "価格" },
  { key: "color", label: "カラー" },
  { key: "size", label: "サイズ" },
  { key: "brand", label: "ブランド" },
];
