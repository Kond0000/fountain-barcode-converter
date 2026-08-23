# LABEL PRINT.app - macOS初回セットアップ

`LABEL PRINT.app`は、Web版と同じCSV読込・ラベル編集・プレビュー・PDF作成画面と、mC-Label3への印刷処理を1つにまとめた一体型Macアプリです。ブラウザやmacOSショートカットは使用しません。

「mC-Label3で印刷」を押すと、アプリ内でページ別PDFと実寸情報をZIPにしてDownloadsへ保存します。ZIPとmanifestを検証して展開し、各ページを別々のCUPSジョブとして接続・登録済みのmC-Label3へ直接送ります。

この設定は、直接印刷を使うMacごとに一度だけ必要です。CSV、PDF、印刷履歴を外部サーバーへ送信・保存することはありません。

## 1. mC-Label3を登録する

1. Star公式の[mC-Label3 ドライバーインストール手順](https://star-m.jp/products/s_print/oml/mclabel3/manual/ja/settings/driverInstall.htm)に従い、macOS用CUPSドライバーをインストールします。
2. macOSへmC-Label3を追加します。AirPrintや汎用ドライバーではなく、StarのmC-Label3用ドライバーで登録してください。
3. 使用するロール紙をセットし、紙幅ガイドとメディア設定を用紙に合わせます。

ターミナルで次を実行します。

```sh
lpstat -e
lpoptions -p "プリンター名" -l
```

アプリには`lpstat -e`で表示される登録済みプリンターが一覧表示されます。使用するmC-Label3のオプションに`Custom.WIDTHxHEIGHT`があることを確認します。

## 2. 未署名アプリを入れる

1. 配布された`LABEL-PRINT-mac.zip`を展開します。配布ビルドはApple Silicon MacとIntel Macの両方に対応します。
2. `LABEL PRINT.app`を「アプリケーション」へ移動します。
3. アプリを一度開きます。
4. 未確認の開発元という警告が出た場合は、アプリを閉じてから「システム設定」>「プライバシーとセキュリティ」>「このまま開く」を選択します。Gatekeeper全体を無効にしないでください。
5. Downloadsへのアクセスを求められた場合は許可します。

未署名アプリはアップデート時にも同様の確認が必要になる場合があります。配布元とZIPの内容を確認したうえで開いてください。

## 3. LABEL PRINT.appから印刷する

1. `LABEL PRINT.app`を開きます。
2. アプリ上部の「印刷先プリンター」で使用するmC-Label3を選択します。選択したCUPSキュー名はそのMacに保存され、次回起動時にも使用されます。「自動検出」を選んだ場合だけ、名前に`MCL32`を含むキューが1台であることを確認します。
3. アプリ内でCSV、用紙幅、バーコード列、印刷対象を確認します。
4. 「mC-Label3で印刷」を押します。
5. `OK:Nページを個別の用紙サイズで受け付けました`というダイアログが表示され、印刷されることを確認します。

`OK:`はCUPSが印刷ジョブを受け付けたことを示し、用紙への物理印刷完了は保証しません。

## 配布用ZIPを作る

開発用Macで次を実行します。

```sh
zsh scripts/build-label-print-mac-app.sh
```

配布するファイルは`dist-macos/LABEL-PRINT-mac.zip`です。これはDeveloper IDで署名・公証していないため、少人数の信頼できる利用者だけへ配布してください。

## エラー別の対処

| アプリ画面の表示 | 対処 |
| --- | --- |
| `印刷ジョブが不正です` | アプリを終了して開き直し、もう一度「mC-Label3で印刷」を押します。|
| `ERROR:印刷ZIPが見つかりません` | ZIPがDownloadsへ保存されたか、Downloadsへのアプリアクセスを確認します。|
| `ERROR:mC-Label3が見つかりません` | Star CUPSドライバーとプリンター登録を確認し、アプリ上部で印刷先を選択します。|
| `ERROR:mC-Label3が複数存在します` | アプリ上部で使用するプリンターを明示的に選択します。|
| `ERROR:保存したプリンターが見つかりません` | macOSへの登録状態を確認し、アプリ上部で印刷先を選び直します。|
| `ERROR:Custom PageSize非対応です` | AirPrintや汎用ドライバーではなく、StarのmC-Label3用ドライバーで登録します。|
| `ERROR:Nページ目のlp印刷失敗` | それ以前のページは送信済みの可能性があります。キューを確認してから再印刷し、重複印刷を避けます。|

アプリはZIP名、UUID、PDF名、ページ番号、幅、高さを固定形式で検証します。`eval`、自動拡大縮小、`fit-to-page`、`lp -n`は使用しません。
