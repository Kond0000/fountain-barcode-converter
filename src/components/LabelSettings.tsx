import { calculateHorizontalMargin, type LabelSettings as LabelSettingsType } from "../types/label";
import { SectionHeader } from "./SectionHeader";

type LabelSettingsProps = {
  settings: LabelSettingsType;
  onChange: (settings: LabelSettingsType) => void;
};

export function LabelSettingsPanel({ settings, onChange }: LabelSettingsProps) {
  const update = (key: keyof LabelSettingsType, value: number) => onChange({ ...settings, [key]: value });
  return (
    <section className="rail-panel label-settings-panel">
      <SectionHeader>ラベル設定</SectionHeader>
      <div className="settings-grid">
        <label className="number-field">
          <span>横幅</span>
          <span className="number-input-wrap">
            <input
              type="number"
              min={1}
              max={200}
              step="0.5"
              value={settings.widthMm}
              onChange={(event) => update("widthMm", Number(event.target.value))}
            />
            <small>mm</small>
          </span>
        </label>
        <div className="number-field">
          <span>高さ <em className="automatic-badge">自動</em></span>
          <span className="automatic-value-wrap">
            <output>内容に合わせる</output>
          </span>
        </div>
        <label className="number-field">
          <span>上下余白</span>
          <span className="number-input-wrap">
            <input
              type="number"
              min={0}
              max={200}
              step="0.5"
              value={settings.marginMm}
              onChange={(event) => update("marginMm", Number(event.target.value))}
            />
            <small>mm</small>
          </span>
        </label>
        <div className="number-field">
          <span>左右余白 <em className="automatic-badge">自動</em></span>
          <span className="number-input-wrap calculated-value-wrap">
            <output aria-live="polite">{calculateHorizontalMargin(settings.marginMm)}</output>
            <small>mm</small>
          </span>
        </div>
      </div>
    </section>
  );
}
