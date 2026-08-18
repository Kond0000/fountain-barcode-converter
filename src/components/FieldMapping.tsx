import { mappingDefinitions, type FieldMapping, type MappingKey } from "../types/mapping";
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
          <label className="mapping-field" key={key}>
            <span>{label}{required ? <em>必須</em> : null}</span>
            <select
              value={mapping[key] ?? ""}
              className={required && !mapping[key] ? "is-invalid" : ""}
              onChange={(event) => onChange(key, event.target.value || undefined)}
            >
              <option value="">使用しない</option>
              {headers.map((header) => <option key={header} value={header}>{header}</option>)}
            </select>
          </label>
        ))}
      </div>
      {!mapping.barcode ? <p className="field-error">PDFを作成するにはバーコード列を選択してください。</p> : null}
    </section>
  );
}
