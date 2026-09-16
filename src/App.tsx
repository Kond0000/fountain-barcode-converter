import { useEffect, useMemo, useRef, useState } from "react";
import { CsvDropzone } from "./components/CsvDropzone";
import { FieldMappingPanel } from "./components/FieldMapping";
import { LabelPreview } from "./components/LabelPreview";
import { LabelPreviewModal } from "./components/LabelPreviewModal";
import { LabelSettingsPanel } from "./components/LabelSettings";
import { PdfActions } from "./components/PdfActions";
import { PdfPreviewDialog, type PdfPreviewDocument } from "./components/PdfPreviewDialog";
import { PrinterSettingsPanel } from "./components/PrinterSettings";
import { ProductGrid, getMatchingPdfImageIndices } from "./components/ProductGrid";
import { SettingsDialog } from "./components/SettingsDialog";
import { WorkHistoryDialog } from "./components/WorkHistoryDialog";
import { detectFields } from "./lib/csv/detectFields";
import { parseCsvFile } from "./lib/csv/parseCsv";
import {
  clearWorkHistory,
  deleteWorkHistory,
  listWorkHistory,
  loadWorkHistory,
  saveWorkHistory,
  type WorkHistorySummary,
} from "./lib/history/workHistory";
import { generateBarcodeTablePdf } from "./lib/pdf/generateBarcodeTable";
import {
  DEFAULT_PDF_TITLE_BASE,
  createPdfTitles,
} from "./lib/pdf/createPdfTitles";
import {
  calculateLabelPageCount,
  createPdfDownload,
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
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [printingMac, setPrintingMac] = useState(false);
  const [printerReadiness, setPrinterReadiness] = useState<MacPrinterReadiness | null>(null);
  const [pdfDownloads, setPdfDownloads] = useState<PdfDownload[]>([]);
  const [pdfPreviews, setPdfPreviews] = useState<PdfPreviewDocument[]>([]);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState(DEFAULT_PDF_TITLE_BASE);
  const [previewListOpen, setPreviewListOpen] = useState(false);
  const [openTool, setOpenTool] = useState<"mapping" | "label" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>();
  const [histories, setHistories] = useState<WorkHistorySummary[]>([]);
  const [macAvailable] = useState(isMacOs);
  const [runningInMacApp] = useState(isMacPrintApp);
  const printInFlightRef = useRef(false);
  const restoringHistoryRef = useRef(false);
  const [message, setMessage] = useState<(
    UserFacingMessage & { tone: "error" | "warning" | "success" }
  ) | null>(null);

  useEffect(() => () => {
    pdfDownloads.forEach((download) => URL.revokeObjectURL(download.url));
  }, [pdfDownloads]);

  useEffect(() => () => {
    pdfPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [pdfPreviews]);

  useEffect(() => {
    setPdfDownloads([]);
    setPdfPreviews([]);
    setPdfPreviewOpen(false);
    if (restoringHistoryRef.current) {
      restoringHistoryRef.current = false;
      return;
    }
    setMessage((current) => current?.tone === "success" ? null : current);
  }, [csvData, mapping, rowStates, settings, pdfTitle]);

  const handleFile = async (file: File) => {
    setLoadingCsv(true);
    setMessage(null);
    try {
      const parsed = await parseCsvFile(file);
      const detectedMapping = detectFields(parsed.headers);
      setCsvData(parsed);
      setMapping(detectedMapping);
      setRowStates(parsed.rows.map(() => ({ selected: true, copies: 1 })));
      setActiveRowIndex(0);
      setPreviewListOpen(false);
      setOpenTool(detectedMapping.barcode ? null : "mapping");
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

  const createCurrentPdfs = async () => {
    const labelElements = createDefaultLabelElements(mapping, { includeBrand: false });
    const tableElements = createDefaultLabelElements(mapping, { includeBrand: false });
    const pdfTitles = createPdfTitles(pdfTitle);
    const [labelBytes, tableBytes] = await Promise.all([
      generateLabelsPdf(selectedEntries, labelElements, settings),
      generateBarcodeTablePdf(selectedEntries, tableElements, pdfTitles.pageTitle),
    ]);
    return { labelBytes, tableBytes, pdfTitles };
  };

  const setCurrentPdfPreviews = (
    labelBytes: Uint8Array,
    tableBytes: Uint8Array,
    pdfTitles: ReturnType<typeof createPdfTitles>,
  ) => {
    setPdfPreviews([
      {
        id: "labels",
        label: "ラベルPDF",
        ...createPdfDownload(labelBytes, pdfTitles.labelsFileName),
      },
      {
        id: "table",
        label: "一覧PDF",
        ...createPdfDownload(tableBytes, pdfTitles.tableFileName),
      },
    ]);
  };

  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      setHistories(await listWorkHistory());
    } catch {
      setHistories([]);
      setHistoryError("この端末の作業履歴を読み込めませんでした。アプリを再起動して、もう一度お試しください。");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRestoreHistory = async (history: WorkHistorySummary) => {
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      const restored = await loadWorkHistory(history.id);
      restoringHistoryRef.current = true;
      setCsvData(restored.csvData);
      setMapping(restored.mapping);
      setRowStates(restored.rowStates);
      setSettings(restored.settings);
      setPdfTitle(restored.pdfTitle);
      setActiveRowIndex(0);
      setPreviewListOpen(false);
      setOpenTool(null);
      setHistoryOpen(false);
      setMessage({
        tone: "success",
        title: "作業履歴を復元しました",
        detail: `${history.csvFileName} の商品データ・列設定・選択状態・枚数・PDFタイトル・画像を復元しました。`,
      });
    } catch {
      setHistoryError("選択した作業履歴を復元できませんでした。別の履歴を選ぶか、アプリを再起動してください。");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteHistory = async (history: WorkHistorySummary) => {
    if (!window.confirm(`「${history.pdfTitle || history.csvFileName}」の作業履歴を削除しますか？`)) return;
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      await deleteWorkHistory(history.id);
      setHistories(await listWorkHistory());
    } catch {
      setHistoryError("作業履歴を削除できませんでした。アプリを再起動して、もう一度お試しください。");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteAllHistory = async () => {
    if (!window.confirm("すべての作業履歴と保存画像を、この端末から削除しますか？\n保存済みのPDF・ZIPは削除されません。")) return;
    setHistoryLoading(true);
    setHistoryError(undefined);
    try {
      await clearWorkHistory();
      setHistories([]);
    } catch {
      setHistoryError("作業履歴をすべて削除できませんでした。アプリを再起動して、もう一度お試しください。");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (!csvData) return;
    if (pdfPreviews.length > 0) {
      setPdfPreviewOpen(true);
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
    setGeneratingPreview(true);
    setMessage(null);
    try {
      const { labelBytes, tableBytes, pdfTitles } = await createCurrentPdfs();
      setCurrentPdfPreviews(labelBytes, tableBytes, pdfTitles);
      setPdfPreviewOpen(true);
      try {
        await saveWorkHistory({ csvData, mapping, rowStates, settings, pdfTitle });
      } catch {
        setMessage({
          tone: "warning",
          title: "作業履歴を保存できませんでした",
          detail: "PDFは確認できますが、端末内の作業履歴には保存できませんでした。",
        });
      }
    } catch (error) {
      setMessage({ tone: "error", ...explainPdfGenerationError(error) });
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleGenerate = async () => {
    if (!csvData) return;
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
      const { labelBytes, tableBytes, pdfTitles } = await createCurrentPdfs();
      const archiveBytes = createStoredZip([
        { fileName: pdfTitles.labelsFileName, bytes: labelBytes },
        { fileName: pdfTitles.tableFileName, bytes: tableBytes },
      ]);
      setPdfDownloads([createZipDownload(archiveBytes, pdfTitles.archiveFileName)]);
      startMacPrintBundleDownload(archiveBytes, pdfTitles.archiveFileName);
      let historyDetail = "この作業は端末内の作業履歴にも保存されました。";
      try {
        await saveWorkHistory({ csvData, mapping, rowStates, settings, pdfTitle });
      } catch {
        historyDetail = "PDFは保存できましたが、端末内の作業履歴には保存できませんでした。";
      }
      setMessage({
        tone: "success",
        title: "PDFをZIPで保存しました",
        detail: `${totalPages}ページのラベルPDFと、${selectedEntries.length}商品のバーコード一覧PDFを1つのZIPにまとめました。${historyDetail} 保存されない場合は画面下部のボタンから保存してください。`,
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
      const result = await generateDirectPrintPages(
        selectedEntries,
        createDefaultLabelElements(mapping, { includeBrand: false }),
        settings,
      );
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

  const statusMessage = message ? (
    <div
      className={`status-message is-${message.tone}`}
      role={message.tone === "error" ? "alert" : "status"}
      aria-live={message.tone === "error" ? "assertive" : "polite"}
    >
      <strong>{message.title}</strong>
      <span>{message.detail}</span>
    </div>
  ) : null;

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
        {csvData ? (
          <>
            <section className="workspace-control-card" aria-label="読み込みファイルと設定">
              <CsvDropzone csvData={csvData} loading={loadingCsv} onFile={handleFile} onOpenHistory={handleOpenHistory} />
              {statusMessage}
              <section className={`workspace-tools ${openTool ? "is-open" : ""}`} aria-label="データとラベルの設定">
                <header className="workspace-tools-bar">
                  <div className="workspace-tools-heading">
                    <strong>データ・ラベル設定</strong>
                    <span>
                      {mapping.barcode ? `バーコード：${mapping.barcode}` : "バーコード列が未設定です"}
                      ・横幅 {settings.widthMm} mm
                    </span>
                  </div>
                  <div className="workspace-tools-actions">
                    <button
                      className={`workspace-tools-button ${openTool === "mapping" ? "is-active" : ""}`}
                      type="button"
                      aria-expanded={openTool === "mapping"}
                      aria-haspopup="dialog"
                      aria-controls="settings-dialog"
                      onClick={() => setOpenTool((current) => current === "mapping" ? null : "mapping")}
                    >
                      {openTool === "mapping" ? "列設定を閉じる" : "列設定"}
                    </button>
                    <button
                      className="label-list-quick-button"
                      type="button"
                      disabled={selectedEntries.length === 0}
                      onClick={() => setPreviewListOpen(true)}
                    >
                      ラベル一覧（{selectedEntries.length}）
                    </button>
                    <button
                      className={`label-tools-toggle ${openTool === "label" ? "is-active" : ""}`}
                      type="button"
                      aria-expanded={openTool === "label"}
                      aria-haspopup="dialog"
                      aria-controls="settings-dialog"
                      onClick={() => setOpenTool((current) => current === "label" ? null : "label")}
                    >
                      {openTool === "label" ? "ラベル設定を閉じる" : "ラベル設定"}
                    </button>
                  </div>
                </header>
              </section>
            </section>
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
                const matchingIndices = new Set(getMatchingPdfImageIndices(
                  csvData.rows,
                  mapping,
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
          <>
            <CsvDropzone csvData={csvData} loading={loadingCsv} onFile={handleFile} onOpenHistory={handleOpenHistory} />
            {statusMessage}
            <section className="getting-started">
              <h2>CSVの列構成は自由です</h2>
              <p>ヘッダーを自動解析し、バーコード・商品名・価格などへ割り当てます。</p>
              <p className="getting-started-note">データは外部へ送信されません。</p>
            </section>
          </>
        )}
      </main>
      {csvData ? (
        <>
          <SettingsDialog
            open={Boolean(openTool)}
            title={openTool === "mapping" ? "CSV列設定" : "ラベル設定"}
            description={openTool === "mapping"
              ? "CSVの各列を、ラベルと一覧PDFで使用する項目へ割り当てます。"
              : "用紙幅と余白を調整し、必要な場合だけバーコードを確認します。"}
            onClose={() => setOpenTool(null)}
          >
            {openTool === "mapping" ? (
              <div className="mapping-tools-content">
                <FieldMappingPanel headers={csvData.headers} mapping={mapping} onChange={updateMapping} />
              </div>
            ) : null}
            {openTool === "label" ? (
              <div className="label-tools-content">
                <LabelSettingsPanel settings={settings} onChange={setSettings} />
                <LabelPreview
                  row={csvData.rows[activeRowIndex]}
                  mapping={mapping}
                  settings={settings}
                  selectedCount={selectedEntries.length}
                  onOpenList={() => setPreviewListOpen(true)}
                />
              </div>
            ) : null}
          </SettingsDialog>
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
            previewLoading={generatingPreview}
            macAvailable={macAvailable}
            runningInMacApp={runningInMacApp}
            macLoading={printingMac}
            macPrintReady={!runningInMacApp || printerReadiness?.canPrint === true}
            macPrintBlockedReason={printerReadiness?.summary}
            appName={MAC_PRINT_APP_NAME}
            pdfTitle={pdfTitle}
            onPdfTitleChange={setPdfTitle}
            onGenerate={handleGenerate}
            onPreview={handlePreviewPdf}
            onMacPrint={handleMacPrint}
          />
        </>
      ) : null}
      <WorkHistoryDialog
        open={historyOpen}
        loading={historyLoading}
        error={historyError}
        histories={histories}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
        onDelete={handleDeleteHistory}
        onDeleteAll={handleDeleteAllHistory}
      />
      <PdfPreviewDialog
        key={pdfPreviews[0]?.url ?? "empty-pdf-preview"}
        open={pdfPreviewOpen}
        documents={pdfPreviews}
        onClose={() => {
          setPdfPreviewOpen(false);
          setPdfPreviews([]);
        }}
      />
    </div>
  );
}
