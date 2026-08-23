import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadMacPrinterSettings,
  isMacPrinterDiagnosticReady,
  saveMacPrinterSelection,
  type MacPrinterDiagnostic,
  type MacPrinterReadiness,
  type MacPrinterSettings,
} from "../lib/macPrinterSettings";
import { explainPrinterSettingsError, type UserFacingMessage } from "../lib/userFacingError";
import { SelectMenu } from "./SelectMenu";

const AUTOMATIC_PRINTER_LABEL = "自動検出（MCL32が1台）";
const INITIAL_DIAGNOSTIC: MacPrinterDiagnostic = {
  status: "warning",
  code: "checking",
  printerName: null,
  summary: "プリンターを確認中",
  detail: "このMacのプリンター登録とドライバー設定を確認しています。",
  checks: [],
  setupSteps: [],
};

function createBridgeErrorDiagnostic(message: UserFacingMessage): MacPrinterDiagnostic {
  return {
    status: "error",
    code: "diagnosticUnavailable",
    printerName: null,
    summary: message.title,
    detail: message.detail,
    checks: [
      {
        id: "diagnostic",
        label: "Macプリンター診断",
        status: "fail",
        detail: "アプリからmacOSの印刷設定を読み取れませんでした。",
      },
    ],
    setupSteps: [
      "LABEL PRINTを終了し、最新版のアプリを起動し直してください。",
      "改善しない場合は、Macの「システム設定」→「プリンタとスキャナ」でプリンターが登録されているか確認してください。",
    ],
  };
}

type PrinterSettingsPanelProps = {
  onReadinessChange?: (readiness: MacPrinterReadiness) => void;
};

export function PrinterSettingsPanel({ onReadinessChange }: PrinterSettingsPanelProps) {
  const [settings, setSettings] = useState<MacPrinterSettings>({
    printers: [],
    selectedPrinter: null,
    diagnostic: INITIAL_DIAGNOSTIC,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<UserFacingMessage | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSettings(await loadMacPrinterSettings());
    } catch (nextError) {
      setError(explainPrinterSettingsError(nextError, "load"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const diagnostic = error ? createBridgeErrorDiagnostic(error) : settings.diagnostic;

  useEffect(() => {
    if (!loading && diagnostic.status === "error") setDetailsOpen(true);
  }, [diagnostic.code, diagnostic.status, loading]);

  const savedPrinterMissing = Boolean(
    settings.selectedPrinter && !settings.printers.includes(settings.selectedPrinter),
  );
  const options = useMemo(() => [
    { value: "", label: AUTOMATIC_PRINTER_LABEL },
    ...(savedPrinterMissing && settings.selectedPrinter
      ? [{ value: settings.selectedPrinter, label: `${settings.selectedPrinter}（現在見つかりません）` }]
      : []),
    ...settings.printers.map((printer) => ({ value: printer, label: printer })),
  ], [savedPrinterMissing, settings.printers, settings.selectedPrinter]);

  const handleChange = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      setSettings(await saveMacPrinterSelection(value || null));
    } catch (nextError) {
      setError(explainPrinterSettingsError(nextError, "save"));
    } finally {
      setSaving(false);
    }
  };

  const displayStatus = loading ? "checking" : saving ? "saving" : diagnostic.status;
  const statusLabel = loading
    ? "プリンターを確認中"
    : saving ? "設定を保存中"
      : diagnostic.summary;
  const statusSymbol = displayStatus === "ready" ? "✓" : displayStatus === "warning" ? "!" : displayStatus === "error" ? "×" : "…";
  const canPrint = !loading
    && !saving
    && !error
    && !savedPrinterMissing
    && isMacPrinterDiagnosticReady(diagnostic);
  const selectionCaption = settings.selectedPrinter
    ? "このMacに印刷先を保存済み"
    : "MCL32が1台の場合に自動選択";

  useEffect(() => {
    onReadinessChange?.({
      canPrint,
      status: displayStatus,
      summary: statusLabel,
      detail: diagnostic.detail,
    });
  }, [canPrint, diagnostic.detail, displayStatus, onReadinessChange, statusLabel]);

  return (
    <section className="printer-settings-panel" aria-labelledby="printer-settings-label">
      <div className="printer-settings-heading">
        <span id="printer-settings-label">印刷先プリンター</span>
        <span className={`printer-status-badge is-${displayStatus}`} role="status" aria-live="polite">
          <span aria-hidden="true">{statusSymbol}</span>
          {statusLabel}
        </span>
      </div>
      <div className="printer-settings-controls">
        <SelectMenu
          idPrefix="printer-settings"
          labelId="printer-settings-label"
          options={options}
          value={settings.selectedPrinter ?? ""}
          disabled={loading || saving}
          invalid={Boolean(error || savedPrinterMissing || diagnostic.status === "error")}
          onChange={(value) => void handleChange(value)}
        />
        <button className="printer-refresh-button" type="button" disabled={loading || saving} onClick={() => void refresh()}>
          再確認
        </button>
      </div>
      <div className="printer-settings-footer">
        <span>{selectionCaption}</span>
        <button
          type="button"
          aria-expanded={detailsOpen}
          aria-controls="printer-diagnostic-detail"
          disabled={loading || saving}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          {detailsOpen ? "診断を閉じる" : "診断詳細"}
        </button>
      </div>
      {detailsOpen ? (
        <section id="printer-diagnostic-detail" className={`printer-diagnostic-card is-${diagnostic.status}`}>
          <div className="printer-diagnostic-header">
            <div>
              <strong>{diagnostic.summary}</strong>
              <p>{diagnostic.detail}</p>
            </div>
            <button type="button" aria-label="プリンター診断を閉じる" onClick={() => setDetailsOpen(false)}>×</button>
          </div>
          {diagnostic.checks.length > 0 ? (
            <ul className="printer-check-list" aria-label="プリンター診断項目">
              {diagnostic.checks.map((check) => (
                <li key={check.id} className={`is-${check.status}`}>
                  <span aria-hidden="true">{check.status === "pass" ? "✓" : check.status === "fail" ? "×" : check.status === "warning" ? "!" : "–"}</span>
                  <div><strong>{check.label}</strong><small>{check.detail}</small></div>
                </li>
              ))}
            </ul>
          ) : null}
          {diagnostic.setupSteps.length > 0 ? (
            <div className="printer-setup-steps">
              <strong>必要なセットアップ</strong>
              <ol>{diagnostic.setupSteps.map((step) => <li key={step}>{step}</li>)}</ol>
            </div>
          ) : null}
          <p className="printer-diagnostic-note">実機の電源・USB接続・用紙切れは、印刷ジョブ送信後にmacOSが判定します。</p>
        </section>
      ) : null}
    </section>
  );
}
