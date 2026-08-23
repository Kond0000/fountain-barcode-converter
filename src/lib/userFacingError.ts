export type UserFacingMessage = {
  title: string;
  detail: string;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

export function explainCsvReadError(error: unknown): UserFacingMessage {
  const message = errorText(error);
  if (message.includes("CSVヘッダー")) {
    return {
      title: "CSVの項目名を確認できませんでした",
      detail: "CSVの1行目に、商品コードや商品名などの項目名を入れてから、もう一度読み込んでください。",
    };
  }
  if (message.includes("商品データがありません")) {
    return {
      title: "CSVに商品データがありません",
      detail: "項目名の次の行から、印刷する商品を1件以上入力してください。",
    };
  }
  return {
    title: "CSVを読み込めませんでした",
    detail: "CSV形式のファイルか確認してください。文字コードはUTF-8またはShift_JISに対応しています。",
  };
}

export function explainPdfGenerationError(error: unknown): UserFacingMessage {
  const message = errorText(error);
  if (message.includes("バーコード") && message.includes("空")) {
    return {
      title: "バーコードが空の商品があります",
      detail: "商品コードが入っているか確認するか、その商品を印刷対象から外してください。",
    };
  }
  if (message.includes("ラベル幅") || message.includes("収まりません") || message.includes("左右余白")) {
    return {
      title: "バーコードがラベルの横幅に収まりません",
      detail: "「ラベル設定」で横幅を広げるか、上下余白を小さくしてから、もう一度お試しください。",
    };
  }
  if (message.includes("数値") || message.includes("0より大きく")) {
    return {
      title: "ラベル設定の数値を確認してください",
      detail: "横幅と上下余白に0より大きい数値を入力してから、もう一度お試しください。",
    };
  }
  if (message.includes("選択してください") || message.includes("1枚以上")) {
    return {
      title: "印刷する商品が選択されていません",
      detail: "商品一覧のチェックを入れ、枚数を1以上にしてからPDFを保存してください。",
    };
  }
  return {
    title: "PDFを作成できませんでした",
    detail: "CSVの内容とラベル設定を確認して、もう一度お試しください。改善しない場合はアプリを再起動してください。",
  };
}

export function explainDirectPrintError(error: unknown, runningInMacApp: boolean): UserFacingMessage {
  const message = errorText(error);
  if (message.includes("印刷ファイルの保存準備")) {
    return {
      title: "印刷ファイルの保存を開始できませんでした",
      detail: "LABEL PRINTを最新版へ更新して再起動し、もう一度印刷してください。",
    };
  }
  if (message.includes("バーコード") && message.includes("空")) {
    return {
      title: "バーコードが空の商品があります",
      detail: "商品コードが入っているか確認するか、その商品を印刷対象から外してください。",
    };
  }
  if (message.includes("印刷ジョブ") || message.includes("URLが不正") || message.includes("ZIP")) {
    return {
      title: "印刷データを準備できませんでした",
      detail: "LABEL PRINTを最新版へ更新して再起動し、もう一度印刷してください。",
    };
  }
  if (!runningInMacApp) {
    return {
      title: "Mac印刷アプリを起動できませんでした",
      detail: "「LABEL PRINT.app」がアプリケーションフォルダにあるか確認してください。すぐに必要な場合はPDF保存をご利用ください。",
    };
  }
  return {
    title: "印刷を開始できませんでした",
    detail: "プリンターの電源とUSB接続を確認し、画面上部のプリンター診断で「使用できます」と表示されてから、もう一度印刷してください。",
  };
}

export function explainBarcodePreviewError(error: unknown): string {
  const message = errorText(error);
  if (message.includes("ラベル幅") || message.includes("収まりません") || message.includes("余白")) {
    return "バーコードを表示できません。ラベルの横幅を広げるか、上下余白を小さくしてください。";
  }
  return "バーコードを表示できません。商品コードとラベル設定を確認してください。";
}

export function explainPrinterSettingsError(
  error: unknown,
  action: "load" | "save",
): UserFacingMessage {
  const message = errorText(error);
  if (message.includes("機能を利用できません") || message.includes("形式が不正")) {
    return {
      title: "Macアプリと正しく連携できません",
      detail: "LABEL PRINTを最新版へ更新して再起動し、もう一度お試しください。",
    };
  }
  return action === "save"
    ? {
        title: "印刷先を保存できませんでした",
        detail: "プリンターがMacに登録されているか確認し、一覧を「再確認」してから選び直してください。",
      }
    : {
        title: "プリンター情報を取得できませんでした",
        detail: "プリンターの電源とUSB接続を確認し、LABEL PRINTを再起動してから「再確認」を押してください。",
      };
}
