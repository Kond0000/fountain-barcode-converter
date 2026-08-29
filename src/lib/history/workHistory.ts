import type { CsvData, RowState } from "../../types/csv";
import type { LabelSettings } from "../../types/label";
import type { FieldMapping } from "../../types/mapping";

export const WORK_HISTORY_RETENTION_DAYS = 90;
export const WORK_HISTORY_MAX_ENTRIES = 30;
export const WORK_HISTORY_MAX_IMAGE_BYTES = 200 * 1024 * 1024;

const DATABASE_NAME = "fountain-label-print-work-history";
const DATABASE_VERSION = 1;
const SUMMARY_STORE = "summaries";
const PAYLOAD_STORE = "payloads";
const RETENTION_MS = WORK_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1_000;

export type WorkHistorySummary = {
  id: string;
  savedAt: number;
  csvFileName: string;
  pdfTitle: string;
  rowCount: number;
  selectedCount: number;
  imageCount: number;
  imageBytes: number;
};

type StoredRowState = {
  selected: boolean;
  copies: number;
  imageId?: string;
};

type StoredImage = {
  id: string;
  file: File;
};

export type WorkHistoryPayload = {
  id: string;
  savedAt: number;
  csvData: CsvData;
  mapping: FieldMapping;
  settings: LabelSettings;
  pdfTitle: string;
  rowStates: StoredRowState[];
  images: StoredImage[];
};

export type WorkHistoryState = {
  csvData: CsvData;
  mapping: FieldMapping;
  settings: LabelSettings;
  pdfTitle: string;
  rowStates: RowState[];
};

type WorkHistoryRecord = {
  summary: WorkHistorySummary;
  payload: WorkHistoryPayload;
};

function createId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createWorkHistoryRecord(
  state: WorkHistoryState,
  savedAt = Date.now(),
  id = createId(),
): WorkHistoryRecord {
  if (state.rowStates.length !== state.csvData.rows.length) {
    throw new Error("商品データと作業状態の行数が一致しません。");
  }

  const imageIds = new Map<File, string>();
  const images: StoredImage[] = [];
  const rowStates = state.rowStates.map<StoredRowState>((rowState) => {
    let imageId: string | undefined;
    if (rowState.pdfImage) {
      imageId = imageIds.get(rowState.pdfImage);
      if (!imageId) {
        imageId = `image-${images.length + 1}`;
        imageIds.set(rowState.pdfImage, imageId);
        images.push({ id: imageId, file: rowState.pdfImage });
      }
    }
    return {
      selected: rowState.selected,
      copies: rowState.copies,
      ...(imageId ? { imageId } : {}),
    };
  });
  const imageBytes = images.reduce((total, image) => total + image.file.size, 0);
  if (imageBytes > WORK_HISTORY_MAX_IMAGE_BYTES) {
    throw new Error("履歴に保存する画像の合計サイズが上限を超えています。");
  }

  return {
    summary: {
      id,
      savedAt,
      csvFileName: state.csvData.fileName,
      pdfTitle: state.pdfTitle,
      rowCount: state.csvData.rows.length,
      selectedCount: state.rowStates.filter((rowState) => rowState.selected).length,
      imageCount: images.length,
      imageBytes,
    },
    payload: {
      id,
      savedAt,
      csvData: state.csvData,
      mapping: state.mapping,
      settings: state.settings,
      pdfTitle: state.pdfTitle,
      rowStates,
      images,
    },
  };
}

export function restoreWorkHistoryPayload(payload: WorkHistoryPayload): WorkHistoryState {
  if (payload.rowStates.length !== payload.csvData.rows.length) {
    throw new Error("保存された商品データと作業状態の行数が一致しません。");
  }
  const images = new Map(payload.images.map((image) => [image.id, image.file]));
  const rowStates = payload.rowStates.map<RowState>((rowState) => {
    const pdfImage = rowState.imageId ? images.get(rowState.imageId) : undefined;
    if (rowState.imageId && !pdfImage) {
      throw new Error("保存された作業画像を復元できませんでした。");
    }
    return {
      selected: rowState.selected,
      copies: rowState.copies,
      ...(pdfImage ? { pdfImage } : {}),
    };
  });
  return {
    csvData: payload.csvData,
    mapping: payload.mapping,
    settings: payload.settings,
    pdfTitle: payload.pdfTitle,
    rowStates,
  };
}

export function getHistoryIdsToDelete(
  summaries: WorkHistorySummary[],
  now = Date.now(),
): string[] {
  const newestFirst = [...summaries].sort((left, right) => right.savedAt - left.savedAt);
  let retainedImageBytes = 0;
  return newestFirst.flatMap((summary, index) => {
    const outsideAgeOrCount = summary.savedAt < now - RETENTION_MS || index >= WORK_HISTORY_MAX_ENTRIES;
    const imageBytes = Number.isFinite(summary.imageBytes) ? summary.imageBytes : 0;
    const outsideImageLimit = retainedImageBytes + imageBytes > WORK_HISTORY_MAX_IMAGE_BYTES;
    if (outsideAgeOrCount || outsideImageLimit) return [summary.id];
    retainedImageBytes += imageBytes;
    return [];
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("この環境では端末内の作業履歴を利用できません。"));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUMMARY_STORE)) {
        database.createObjectStore(SUMMARY_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PAYLOAD_STORE)) {
        database.createObjectStore(PAYLOAD_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("作業履歴を開けませんでした。"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("作業履歴を読み取れませんでした。"));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("作業履歴を保存できませんでした。"));
    transaction.onabort = () => reject(transaction.error ?? new Error("作業履歴の保存が中断されました。"));
  });
}

async function removeHistoryIds(database: IDBDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const transaction = database.transaction([SUMMARY_STORE, PAYLOAD_STORE], "readwrite");
  const summaries = transaction.objectStore(SUMMARY_STORE);
  const payloads = transaction.objectStore(PAYLOAD_STORE);
  ids.forEach((id) => {
    summaries.delete(id);
    payloads.delete(id);
  });
  await transactionDone(transaction);
}

async function cleanUpHistory(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(SUMMARY_STORE, "readonly");
  const summaries = await requestResult<WorkHistorySummary[]>(
    transaction.objectStore(SUMMARY_STORE).getAll(),
  );
  await removeHistoryIds(database, getHistoryIdsToDelete(summaries));
}

export async function saveWorkHistory(state: WorkHistoryState): Promise<WorkHistorySummary> {
  const database = await openDatabase();
  try {
    const record = createWorkHistoryRecord(state);
    const transaction = database.transaction([SUMMARY_STORE, PAYLOAD_STORE], "readwrite");
    transaction.objectStore(SUMMARY_STORE).put(record.summary);
    transaction.objectStore(PAYLOAD_STORE).put(record.payload);
    await transactionDone(transaction);
    await cleanUpHistory(database);
    return record.summary;
  } finally {
    database.close();
  }
}

export async function listWorkHistory(): Promise<WorkHistorySummary[]> {
  const database = await openDatabase();
  try {
    await cleanUpHistory(database);
    const transaction = database.transaction(SUMMARY_STORE, "readonly");
    const summaries = await requestResult<WorkHistorySummary[]>(
      transaction.objectStore(SUMMARY_STORE).getAll(),
    );
    return summaries.sort((left, right) => right.savedAt - left.savedAt);
  } finally {
    database.close();
  }
}

export async function loadWorkHistory(id: string): Promise<WorkHistoryState> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(PAYLOAD_STORE, "readonly");
    const payload = await requestResult<WorkHistoryPayload | undefined>(
      transaction.objectStore(PAYLOAD_STORE).get(id),
    );
    if (!payload) throw new Error("選択した作業履歴が見つかりません。");
    return restoreWorkHistoryPayload(payload);
  } finally {
    database.close();
  }
}

export async function deleteWorkHistory(id: string): Promise<void> {
  const database = await openDatabase();
  try {
    await removeHistoryIds(database, [id]);
  } finally {
    database.close();
  }
}
