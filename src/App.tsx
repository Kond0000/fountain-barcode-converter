import { useEffect, useMemo, useState } from "react";
import { CsvDropzone } from "./components/CsvDropzone";
import { FieldMappingPanel } from "./components/FieldMapping";
import { LabelPreview } from "./components/LabelPreview";
import { LabelPreviewModal } from "./components/LabelPreviewModal";
import { LabelSettingsPanel } from "./components/LabelSettings";
import { PdfActions } from "./components/PdfActions";
import { ProductGrid } from "./components/ProductGrid";
import { detectFields } from "./lib/csv/detectFields";
import { parseCsvFile } from "./lib/csv/parseCsv";
import {
  calculateLabelPageCount,
  createPdfDownload,
  generateDirectPrintPages,
  generateLabelsPdf,
  validateLabelSettings,
  type PdfDownload,
} from "./lib/pdf/generateLabels";
import {
  createMacPrintBundle,
  createMacShortcutUrl,
  isMacOs,
  launchMacShortcut,
  MAC_PRINT_SHORTCUT_NAME,
  startMacPrintBundleDownload,
  startPdfDownload,
} from "./lib/macShortcutPrint";
import type { CsvData, RowState } from "./types/csv";
import {
  createDefaultLabelElements,
  DEFAULT_LABEL_SETTINGS,
  type LabelSettings,
} from "./types/label";
import type { FieldMapping, MappingKey } from "./types/mapping";

function createPdfFileName(): string {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `labels-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.pdf`;
}

export default function App() {
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [rowStates, setRowStates] = useState<RowState[]>([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [settings, setSettings] = useState<LabelSettings>(DEFAULT_LABEL_SETTINGS);
  const [loadingCsv, setLoadingCsv] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printingMac, setPrintingMac] = useState(false);
  const [pdfDownload, setPdfDownload] = useState<PdfDownload | null>(null);
  const [previewListOpen, setPreviewListOpen] = useState(false);
  const [macAvailable] = useState(isMacOs);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => () => {
    if (pdfDownload) URL.revokeObjectURL(pdfDownload.url);
  }, [pdfDownload]);

  useEffect(() => {
    setPdfDownload(null);
    setMessage((current) => current?.tone === "success" ? null : current);
  }, [csvData, mapping, rowStates, settings]);

  const handleFile = async (file: File) => {
    setLoadingCsv(true);
    setMessage(null);
    try {
      const parsed = await parseCsvFile(file);
      setCsvData(parsed);
      setMapping(detectFields(parsed.headers));
      setRowStates(parsed.rows.map(() => ({ selected: true, copies: 1 })));
      setActiveRowIndex(0);
      setPreviewListOpen(false);
      if (parsed.warnings.length > 0) {
        setMessage({ tone: "error", text: `CSVを読み込みましたが、${parsed.warnings.length}件の注意があります。` });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "CSVを読み込めませんでした。" });
    } finally {
      setLoadingCsv(false);
    }
  };

  const updateMapping = (key: MappingKey, value?: string) => {
    setMapping((current) => ({ ...current, [key]: value }));
  };

  const updateRowState = (index: number, patch: Partial<RowState>) => {
    setRowStates((current) => current.map((state, rowIndex) => rowIndex === index ? { ...state, ...patch } : state));
  };

  const selectedEntries = useMemo(
    () => csvData?.rows.flatMap((row, index) => {
      const state = rowStates[index];
      return state?.selected ? [{ row, copies: state.copies }] : [];
    }) ?? [],
    [csvData, rowStates],
  );
  const totalPages = calculateLabelPageCount(selectedEntries);

  const handleGenerate = async () => {
    if (!mapping.barcode) {
      setMessage({ tone: "error", text: "バーコードに使用するCSV列を選択してください。" });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const bytes = await generateLabelsPdf(selectedEntries, createDefaultLabelElements(mapping), settings);
      const download = createPdfDownload(bytes, createPdfFileName());
      setPdfDownload(download);
      startPdfDownload(bytes, download.fileName);
      setMessage({ tone: "success", text: `${totalPages}ページのラベルPDFの保存を開始しました。保存されない場合は「PDFを保存」を押してください。` });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "PDFを作成できませんでした。";
      setMessage({ tone: "error", text: `PDF生成に失敗しました。${detail}` });
    } finally {
      setGenerating(false);
    }
  };

  const handleMacPrint = async () => {
    if (!macAvailable) {
      setMessage({ tone: "error", text: "mC-Label3への直接印刷はMacで利用できます。PDF保存をご利用ください。" });
      return;
    }
    if (!mapping.barcode || totalPages === 0) {
      setMessage({ tone: "error", text: "バーコード列と印刷対象を確認してください。" });
      return;
    }

    setPrintingMac(true);
    setMessage(null);
    try {
      validateLabelSettings(settings);
      const barcodeField = mapping.barcode;
      if (selectedEntries.some(({ row }) => !row[barcodeField]?.trim())) {
        throw new Error("印刷対象にバーコード値が空の商品があります。");
      }
      const jobId = crypto.randomUUID();
      const result = await generateDirectPrintPages(selectedEntries, createDefaultLabelElements(mapping), settings);
      const bundle = createMacPrintBundle({ jobId, pages: result.pages });
      startMacPrintBundleDownload(bundle.bytes, bundle.job.archiveName);
      launchMacShortcut(createMacShortcutUrl(MAC_PRINT_SHORTCUT_NAME, bundle.job));
      setMessage({
        tone: "success",
        text: `Macショートカットを起動しました。${bundle.job.pageCount}ページを、それぞれの高さに合わせて1枚ずつ印刷します。実際の印刷結果はMac側の通知で確認してください。`,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "不明なエラーです。";
      setMessage({
        tone: "error",
        text: `直接印刷を開始できませんでした。${detail} Macショートカットを起動できない場合はPDF保存をご利用ください。`,
      });
    } finally {
      setPrintingMac(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>LABEL PRINT</h1>
        <p>CSVからラベルPDFを作成</p>
      </header>
      <main className="app-grid">
        <CsvDropzone csvData={csvData} loading={loadingCsv} onFile={handleFile} />
        {message ? <div className={`status-message is-${message.tone}`} role="status">{message.text}</div> : null}
        {csvData ? (
          <>
            <FieldMappingPanel headers={csvData.headers} mapping={mapping} onChange={updateMapping} />
            <ProductGrid
              rows={csvData.rows}
              rowStates={rowStates}
              mapping={mapping}
              activeRowIndex={activeRowIndex}
              onActivate={setActiveRowIndex}
              onSelectedChange={(index, selected) => {
                updateRowState(index, { selected });
                if (selected) setActiveRowIndex(index);
              }}
              onCopiesChange={(index, copies) => updateRowState(index, {
                copies: Math.min(999, Math.max(1, Number.isFinite(copies) ? Math.floor(copies) : 1)),
              })}
              onToggleMany={(indices, selected) => {
                const targetIndices = new Set(indices);
                setRowStates((current) =>
                  current.map((state, index) => targetIndices.has(index) ? { ...state, selected } : state),
                );
              }}
            />
            <aside className="right-rail">
              <LabelSettingsPanel settings={settings} onChange={setSettings} />
              <LabelPreview
                row={csvData.rows[activeRowIndex]}
                mapping={mapping}
                settings={settings}
                selectedCount={selectedEntries.length}
                onOpenList={() => setPreviewListOpen(true)}
              />
            </aside>
          </>
        ) : (
          <section className="getting-started">
            <h2>CSVの列構成は自由です</h2>
            <p>ヘッダーを自動解析し、バーコード・商品名・価格などへ割り当てます。データは外部へ送信されません。</p>
          </section>
        )}
      </main>
      {csvData ? (
        <>
          <LabelPreviewModal
            open={previewListOpen}
            entries={selectedEntries}
            mapping={mapping}
            settings={settings}
            onClose={() => setPreviewListOpen(false)}
          />
          <PdfActions
            selectedCount={selectedEntries.length}
            totalPages={totalPages}
            labelWidthMm={settings.widthMm}
            disabled={!mapping.barcode || totalPages === 0}
            download={pdfDownload}
            loading={generating}
            macAvailable={macAvailable}
            macLoading={printingMac}
            shortcutName={MAC_PRINT_SHORTCUT_NAME}
            onGenerate={handleGenerate}
            onMacPrint={handleMacPrint}
          />
        </>
      ) : null}
    </div>
  );
}
