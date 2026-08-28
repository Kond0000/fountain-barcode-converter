import { useEffect, useMemo, useRef, useState } from "react";
import { CsvDropzone } from "./components/CsvDropzone";
import { FieldMappingPanel } from "./components/FieldMapping";
import { LabelPreview } from "./components/LabelPreview";
import { LabelPreviewModal } from "./components/LabelPreviewModal";
import { LabelSettingsPanel } from "./components/LabelSettings";
import { PdfActions } from "./components/PdfActions";
import { PrinterSettingsPanel } from "./components/PrinterSettings";
import { ProductGrid, getMatchingProductCodeIndices } from "./components/ProductGrid";
import { detectFields } from "./lib/csv/detectFields";
import { parseCsvFile } from "./lib/csv/parseCsv";
import { generateBarcodeTablePdf } from "./lib/pdf/generateBarcodeTable";
import {
  DEFAULT_PDF_TITLE_BASE,
  createPdfTitles,
  formatPdfIssueDate,
} from "./lib/pdf/createPdfTitles";
import {
  calculateLabelPageCount,
  generateDirectPrintPages,
  generateLabelsPdf,
  validateLabelSettings,
  type PdfDownload,
} from "./lib/pdf/generateLabels";
import { createStoredZip } from "./lib/zip/createStoredZip";
import {
  createMacPrintBundle,
  createMacPrintAppUrl,
  isMacPrintApp,
  isMacOs,
  launchMacPrintApp,
  MAC_PRINT_APP_NAME,
  startMacPrintBundleDownload,
  startPreparedMacPrintBundleDownload,
} from "./lib/macShortcutPrint";
import {
  explainCsvReadError,
  explainDirectPrintError,
  explainPdfGenerationError,
  type UserFacingMessage,
} from "./lib/userFacingError";
import type { MacPrinterReadiness } from "./lib/macPrinterSettings";
import type { CsvData, RowState } from "./types/csv";
import {
  createDefaultLabelElements,
  DEFAULT_LABEL_SETTINGS,
  type LabelSettings,
} from "./types/label";
import type { FieldMapping, MappingKey } from "./types/mapping";

function createZipDownload(bytes: Uint8Array, fileName: string): PdfDownload {
  const blob = new Blob([bytes], { type: "application/zip" });
  return { fileName, url: URL.createObjectURL(blob) };
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
  const [printerReadiness, setPrinterReadiness] = useState<MacPrinterReadiness | null>(null);
  const [pdfDownloads, setPdfDownloads] = useState<PdfDownload[]>([]);
  const [pdfTitle, setPdfTitle] = useState(DEFAULT_PDF_TITLE_BASE);
  const [previewListOpen, setPreviewListOpen] = useState(false);
  const [macAvailable] = useState(isMacOs);
  const [runningInMacApp] = useState(isMacPrintApp);
  const printInFlightRef = useRef(false);
  const [message, setMessage] = useState<(
    UserFacingMessage & { tone: "error" | "warning" | "success" }
  ) | null>(null);

  useEffect(() => () => {
    pdfDownloads.forEach((download) => URL.revokeObjectURL(download.url));
  }, [pdfDownloads]);

  useEffect(() => {
    setPdfDownloads([]);
    setMessage((current) => current?.tone === "success" ? null : current);
  }, [csvData, mapping, rowStates, settings, pdfTitle]);

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
        setMessage({
          tone: "warning",
          title: "CSVを読み込みましたが、確認が必要な行があります",
          detail: `${parsed.warnings.length}件の読み取り上の注意があります。商品一覧の内容を確認してから印刷してください。`,
        });
      }
    } catch (error) {
      setMessage({ tone: "error", ...explainCsvReadError(error) });
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
      return state?.selected ? [{ row, copies: state.copies, imageFile: state.pdfImage }] : [];
    }) ?? [],
    [csvData, rowStates],
  );
  const totalPages = calculateLabelPageCount(selectedEntries);

  const handleGenerate = async () => {
    if (!mapping.barcode) {
      setMessage({
        tone: "error",
        title: "バーコード列が設定されていません",
        detail: "「ラベルデータ設定」のバーコード欄で、商品コードが入っているCSV列を選択してください。",
      });
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const elements = createDefaultLabelElements(mapping);
      const pdfTitles = createPdfTitles(pdfTitle, new Date());
      const [labelBytes, tableBytes] = await Promise.all([
        generateLabelsPdf(selectedEntries, elements, settings),
        generateBarcodeTablePdf(selectedEntries, elements, pdfTitles.pageTitle),
      ]);
      const archiveBytes = createStoredZip([
        { fileName: pdfTitles.labelsFileName, bytes: labelBytes },
        { fileName: pdfTitles.tableFileName, bytes: tableBytes },
      ]);
      setPdfDownloads([createZipDownload(archiveBytes, pdfTitles.archiveFileName)]);
      startMacPrintBundleDownload(archiveBytes, pdfTitles.archiveFileName);
      setMessage({
        tone: "success",
        title: "PDFをZIPで保存しました",
        detail: `${totalPages}ページのラベルPDFと、${selectedEntries.length}商品のバーコード一覧PDFを1つのZIPにまとめました。保存されない場合は画面下部のボタンから保存してください。`,
      });
    } catch (error) {
      setMessage({ tone: "error", ...explainPdfGenerationError(error) });
    } finally {
      setGenerating(false);
    }
  };

  const handleMacPrint = async () => {
    if (printInFlightRef.current) return;
    if (!macAvailable) {
      setMessage({
        tone: "error",
        title: "この端末から直接印刷できません",
        detail: "mC-Label3への直接印刷はMacのLABEL PRINTアプリで利用できます。この端末ではPDF保存をご利用ください。",
      });
      return;
    }
    if (!mapping.barcode) {
      setMessage({
        tone: "error",
        title: "バーコード列が設定されていません",
        detail: "「ラベルデータ設定」のバーコード欄で、商品コードが入っているCSV列を選択してください。",
      });
      return;
    }
    if (totalPages === 0) {
      setMessage({
        tone: "error",
        title: "印刷する商品が選択されていません",
        detail: "商品一覧のチェックを入れ、枚数を1以上にしてから印刷してください。",
      });
      return;
    }
    if (runningInMacApp && !printerReadiness?.canPrint) {
      setMessage({
        tone: "error",
        title: "プリンターの準備が完了していません",
        detail: `${printerReadiness?.summary ?? "プリンターを確認中です"}。画面上部のプリンター診断を確認してから、もう一度お試しください。`,
      });
      return;
    }

    printInFlightRef.current = true;
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
      if (runningInMacApp) {
        const printResult = await startPreparedMacPrintBundleDownload(bundle);
        setMessage({
          tone: "success",
          title: "印刷ジョブを送信しました",
          detail: printResult.message || `${bundle.job.pageCount}ページをmC-Label3へ送信しました。`,
        });
      } else {
        startMacPrintBundleDownload(bundle.bytes, bundle.job.archiveName);
        launchMacPrintApp(createMacPrintAppUrl(bundle.job));
        setMessage({
          tone: "success",
          title: "Mac印刷アプリを起動しました",
          detail: `ZIPの保存完了後、${bundle.job.pageCount}ページをそれぞれの高さに合わせて印刷します。結果は${MAC_PRINT_APP_NAME}で確認してください。`,
        });
      }
    } catch (error) {
      setMessage({ tone: "error", ...explainDirectPrintError(error, runningInMacApp) });
    } finally {
      printInFlightRef.current = false;
      setPrintingMac(false);
    }
  };

  return (
    <div className={`app-shell ${csvData ? "has-data" : ""}`}>
      <header className={`app-header ${runningInMacApp ? "has-printer-settings" : ""}`}>
        <div className="app-header-inner">
          <div className="app-brand">
            <h1>LABEL PRINT</h1>
            <p>CSVからラベルPDFを作成・mC-Label3へ印刷</p>
          </div>
          {runningInMacApp ? <PrinterSettingsPanel onReadinessChange={setPrinterReadiness} /> : null}
        </div>
      </header>
      <main className={`app-grid ${csvData ? "has-data" : "is-empty"}`}>
        <CsvDropzone csvData={csvData} loading={loadingCsv} onFile={handleFile} />
        {message ? (
          <div
            className={`status-message is-${message.tone}`}
            role={message.tone === "error" ? "alert" : "status"}
            aria-live={message.tone === "error" ? "assertive" : "polite"}
          >
            <strong>{message.title}</strong>
            <span>{message.detail}</span>
          </div>
        ) : null}
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
              onPdfImageChange={(index, pdfImage) => {
                const matchingIndices = new Set(getMatchingProductCodeIndices(
                  csvData.rows,
                  mapping.barcode,
                  mapping.size,
                  index,
                ));
                setRowStates((current) => current.map((state, rowIndex) =>
                  matchingIndices.has(rowIndex) ? { ...state, pdfImage } : state,
                ));
              }}
              onToggleMany={(indices, selected) => {
                const targetIndices = new Set(indices);
                setRowStates((current) =>
                  current.map((state, index) => targetIndices.has(index) ? { ...state, selected } : state),
                );
              }}
            />
          </>
        ) : (
          <section className="getting-started">
            <h2>CSVの列構成は自由です</h2>
            <p>ヘッダーを自動解析し、バーコード・商品名・価格などへ割り当てます。</p>
            <p className="getting-started-note">データは外部へ送信されません。</p>
          </section>
        )}
      </main>
      {csvData ? (
        <aside className="right-rail" aria-label="ラベル設定とプレビュー">
          <LabelSettingsPanel settings={settings} onChange={setSettings} />
          <LabelPreview
            row={csvData.rows[activeRowIndex]}
            mapping={mapping}
            settings={settings}
            selectedCount={selectedEntries.length}
            onOpenList={() => setPreviewListOpen(true)}
          />
        </aside>
      ) : null}
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
            downloads={pdfDownloads}
            loading={generating}
            macAvailable={macAvailable}
            runningInMacApp={runningInMacApp}
            macLoading={printingMac}
            macPrintReady={!runningInMacApp || printerReadiness?.canPrint === true}
            macPrintBlockedReason={printerReadiness?.summary}
            appName={MAC_PRINT_APP_NAME}
            pdfTitle={pdfTitle}
            pdfIssueDate={formatPdfIssueDate(new Date())}
            onPdfTitleChange={setPdfTitle}
            onGenerate={handleGenerate}
            onMacPrint={handleMacPrint}
          />
        </>
      ) : null}
    </div>
  );
}
