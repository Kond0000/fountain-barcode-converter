import { mappingDefinitions, type FieldMapping, type MappingKey } from "../types/mapping";
import { SelectMenu } from "./SelectMenu";
import { SectionHeader } from "./SectionHeader";

type FieldMappingProps = {
  headers: string[];
  mapping: FieldMapping;
  onChange: (key: MappingKey, value?: string) => void;
};

export function FieldMappingPanel({ headers, mapping, onChange }: FieldMappingProps) {
  return (
    <section className="mapping-panel">
      <SectionHeader>ラベルデータ設定</SectionHeader>
      <div className="mapping-grid">
        {mappingDefinitions.map(({ key, label, required }) => (
          <div className="mapping-field" key={key}>
            <span className="mapping-label" id={`mapping-${key}-label`}>{label}{required ? <em>必須</em> : null}</span>
            <SelectMenu
              idPrefix={`mapping-${key}`}
              labelId={`mapping-${key}-label`}
              options={[{ value: "", label: "使用しない" }, ...headers.map((header) => ({ value: header, label: header }))]}
              value={mapping[key] ?? ""}
              invalid={Boolean(required && !mapping[key])}
              onChange={(value) => onChange(key, value || undefined)}
            />
          </div>
        ))}
      </div>
      <p className="mapping-note">「印刷枚数（在庫）」の列を変更すると、全商品の枚数に反映します。「使用しない」を選ぶと1枚に戻ります。0枚の商品は印刷しません。</p>
      {!mapping.barcode ? <p className="field-error">「バーコード」で、商品コードが入っているCSV列を選択してください。</p> : null}
    </section>
  );
}
