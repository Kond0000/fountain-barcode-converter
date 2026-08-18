import { useRef, useState, type DragEvent } from "react";
import type { CsvData } from "../types/csv";
import { CheckCircleIcon, FileIcon, UploadIcon } from "./Icons";

type CsvDropzoneProps = {
  csvData: CsvData | null;
  loading: boolean;
  onFile: (file: File) => void;
};

export function CsvDropzone({ csvData, loading, onFile }: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const acceptFile = (file?: File) => { if (file) onFile(file); };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  };

  return (
    <section
      className={`csv-dropzone ${dragging ? "is-dragging" : ""} ${csvData ? "is-loaded" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      aria-label="CSVファイル読み込み"
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".csv,text/csv"
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
      {csvData ? (
        <>
          <div className="loaded-file-icon"><CheckCircleIcon /></div>
          <FileIcon className="file-icon" />
          <div className="loaded-file-copy">
            <strong>{csvData.fileName}</strong>
            <div className="file-meta">
              <span>{csvData.rows.length} 行</span>
              <span>{csvData.headers.length} 列</span>
              <span>{csvData.encoding} (CSV)</span>
              <span className="success-copy">正常に読み込みました</span>
            </div>
          </div>
          <button className="secondary-button replace-button" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
            ファイルを置き換える
          </button>
        </>
      ) : (
        <button className="empty-dropzone-button" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
          <UploadIcon />
          <span>
            <strong>{loading ? "CSVを読み込み中…" : "CSVファイルをドロップ"}</strong>
            <small>またはクリックしてファイルを選択</small>
          </span>
        </button>
      )}
    </section>
  );
}
