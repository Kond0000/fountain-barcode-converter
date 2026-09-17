# LABEL PRINT

任意のCSVヘッダーを動的に解析し、CSV列をラベル項目へ割り当ててCODE128ラベルを作成するReact / TypeScript / Viteアプリです。macOS版は同じ画面を`LABEL PRINT.app`へ内蔵し、PDF保存とmC-Label3への直接印刷を1つのアプリで行います。Cloudflare版はブラウザでPDFを作成できます。

PDF保存では、1ラベルを1ページにした「バーコード別ラベルPDF」と、選択商品をA4縦向き・4列×4段の商品カードにまとめた「バーコード一覧PDF」の2種類を作成し、1つのZIPにまとめて保存します。PDFタイトルへ任意の文字を入力すると、一覧PDFのページ見出しとファイル名が「任意テキスト - YYYY年M月D日発行」になります。一覧PDFは商品名、型番（値のみ）、カラー・サイズ、価格、バーコードを1商品につき1枚のカードで掲載し、ラベルの印刷枚数は掲載しません。商品一覧の「一覧PDF画像」から商品ごとにPNG・JPEG・WebP画像を設定すると、比率を維持してカードへ配置します。画像を設定していない商品には、既定の「ドドド」サンプル画像が表示されます。サンプル画像には上下に2mmずつ余白を設け、比率を維持して配置します。個別に設定した商品画像には、この余白を付けません。右下のサイズ表示は白背景のボックスを画像に重ね、画像の一部が隠れることを許容してサイズの文字を読みやすく表示します。

保存用のラベルPDFは2倍解像度（16px/mm、約406.4dpi）のアンチエイリアス描画を指定実寸で保持し、画面表示や拡大時の文字を滑らかにします。mC-Label3への直接印刷では、その画像を実機ドットごとに面積平均して閾値128で一度だけ二値化します。直接印刷PDFと用紙寸法はStar CUPSの203dpiラスタへ合わせ、画像の1pxがCUPSの1ドットになるようにします。CODE128は横方向へ引き伸ばさず、各モジュールを均一な整数ドット幅で描画して必要な読取余白を確保します。符号化後のモジュール数に応じてバーコード全体の幅は変わり、ラベル中央へ配置されます。代表的な短い・長い商品コードは、生成PNGを独立したZXingデコーダーで元の値へ戻せることを自動テストします。

商品名は1行28文字を上限に単語の区切りを優先して改行し、ラベルの実幅に合わせて3.0〜3.2mmの範囲で文字サイズを自動調整します。最小3.0mmでも幅を超える場合は、文字を小さくせずに次の行へ送ります。カラー・サイズ表記（2.8mm）より必ず大きく表示されます。型番はグループコード列も同じ項目として設定・印字できます。商品名にブランド名を含める運用のため、バーコード別ラベルにはブランド名を重ねて印字しません。

型番・カラー・サイズには項目名を付け、同じ文字サイズ・太さのグループとしてまとめます。商品名・詳細・価格・バーコードの間には余白を設け、商品名は読みやすい行間で表示します。価格は右端へ揃えます。割り当てたカラーまたはサイズの値が空欄の場合は「-」を表示します。プレビューとPDFで同じレイアウトを使用します。

商品一覧には割り当て中の項目だけを表示します。ブランド列を割り当てた場合は、商品名の右隣にブランド列と各商品の値が表示されます。

- 公開リポジトリ: <https://github.com/Kond0000/fountain-barcode-converter>
- 本番環境: [Cloudflare Pages](https://fountain-barcode-converter.pages.dev/)（GitHubの`main`ブランチから自動デプロイ）
- 初めて使う方: [LABEL PRINT マニュアル目次](https://app.notion.com/p/3c271be76cc58186b1c5cdb5ce7505b6)
- CSV処理とPDF生成: 利用者のブラウザまたはMacアプリ内で完結

## 利用できる機能

| 機能 | Windows | macOS | その他のPC |
| --- | --- | --- | --- |
| CSV読込・ラベル編集・プレビュー | ○ | ○ | ○ |
| PDF保存 | ○ | ○ | ○ |
| mC-Label3へ直接印刷 | - | ○ | - |

Cloudflare上のWebアプリは全員が同じURLから利用できます。Macで直接印刷する場合は一体型の`LABEL PRINT.app`を使用し、ブラウザを開く必要はありません。

ラベル横幅の初期値は、mC-Label3で一般的に使用される58mmです。実際にセットしたロール紙の幅が異なる場合は、画面の「横幅」を用紙に合わせて変更してください。

mC-Label3への直接印刷では、利用するMacごとにプリンタードライバーと`LABEL PRINT.app`を一度設定します。アプリ上部の「印刷先プリンター」でmacOSに登録済みのCUPSキューを選択すると、そのMacに保存され、次回以降も同じプリンターへ送信します。アプリはブラウザやmacOSショートカットを介さず、選択したmC-Label3へCUPSで直接送信します。

## アプリの構成（Webフロントエンド＋ネイティブラッパー）

`LABEL PRINT.app`は、Reactで作ったWeb画面をMacアプリのウィンドウ内で動かし、Webブラウザだけでは扱えないプリンター設定とCUPS印刷をSwiftで補う**ハイブリッドアプリ**です。インターネット上のWeb版をアプリから開いているのではなく、ビルド時点のWeb版を`.app`の中へコピーしています。

```text
React / TypeScriptのソース（src/）
                │ npm run build
                ▼
         Web版の完成物（dist/）
          ├─ Cloudflare Pagesで配信
          └─ LABEL PRINT.app内へコピー
                       │
                       ▼
            Swift製ネイティブラッパー
        WKWebView・ファイル保存・プリンター設定
                       │
                       ▼
             印刷スクリプト → CUPS → mC-Label3
```

役割は次のように分かれています。

| モジュール | 主な役割 | 主な場所 |
| --- | --- | --- |
| Reactフロントエンド | CSV解析、項目設定、商品選択、プレビュー、バーコード・PDF・印刷ZIPの生成 | `src/` |
| Swiftネイティブラッパー | Macのアプリウィンドウ、React画面の表示、Downloadsへの保存、プリンター一覧・診断、印刷処理の起動 | `macos/LabelPrintMac/` |
| 印刷スクリプト | ZIPとページ寸法を検証し、選択したプリンターへ各PDFをCUPSの`lp`コマンドで送信 | `scripts/mclabel3-print-example.sh` |
| Macアプリのビルド処理 | Web版、Swift実行ファイル、印刷スクリプト、アイコンを1つの`.app`へまとめ、配布用ZIPを作成 | `scripts/build-label-print-mac-app.sh` |

Macアプリを起動すると、Swift側が`127.0.0.1:47831`で`.app`内のWebファイルだけを配信し、Mac標準の`WKWebView`がその画面を表示します。ホストとポートを固定することで、端末内の作業履歴をアプリの再起動・再ビルド後も同じ保存領域から読み込みます。このアドレスは同じMac内だけで使用されるもので、外部サーバーへ接続するためのものではありません。

React画面とSwift側は、`WKWebView`のメッセージ連携で通信します。React側で「mC-Label3で印刷」を押すと、次の順序で処理します。

1. React側が選択中の商品から、ページ別PDFと用紙寸法を含む印刷ZIPを生成します。
2. Swift側が保存済みプリンターとドライバーの対応状況を確認します。
3. ZIPをDownloadsへ保存し、保存完了後に同梱の印刷スクリプトを起動します。
4. 印刷スクリプトがZIPを検証し、各ページを指定寸法のCUPSジョブとしてmC-Label3へ送信します。

このプロジェクトに、常時起動するAPIサーバーやクラウド側のバックエンドはありません。Cloudflare Pages版も静的なWebファイルだけで動作します。React側を変更して`npm run build`すると`dist/`は更新されますが、すでに配布した`.app`の中身は自動更新されません。Mac版へ反映するには`zsh scripts/build-label-print-mac-app.sh`で再ビルドし、配布用ZIPを再配布する必要があります。将来、別のバックエンドを追加しても自動では`.app`にコピーされないため、配置方法または接続先を別途設計します。

## 別のMacでmC-Label3直接印刷を設定する

Macごとに次の設定が必要です。

1. mC-Label3のmacOSドライバーをインストールし、プリンターを追加します。
2. 配布された`LABEL-PRINT-mac.zip`を展開し、`LABEL PRINT.app`を「アプリケーション」へ移動します。配布ビルドはApple Silicon MacとIntel Macの両方に対応します。
3. `LABEL PRINT.app`を開きます。未署名アプリの警告が出た場合は、内容を確認して「システム設定」>「プライバシーとセキュリティ」から「このまま開く」を選択します。
4. アプリ上部の「印刷先プリンター」で使用するmC-Label3を選択します。選択内容はそのMacに保存されます。
5. アプリ内でCSVを読み込み、ラベルを確認して「mC-Label3で印刷」を押します。

`LABEL PRINT.app`は、画面・PDF生成・印刷処理をすべて内蔵しています。アプリ内で一時的な印刷ZIPをDownloadsへ保存・検証し、mC-Label3へ送ります。CSVの内容とPDFを外部サーバーへ送ることはありません。詳しい確認方法とトラブルシューティングは[Mac印刷アプリ設定](docs/macos-print-app.md)を参照してください。

## ローカル開発

必要環境はNode.js 22とnpmです。

```bash
npm ci
npm run dev
```

テスト用CSVは`public/sample-products.csv`にあります。

```bash
npm test
npm run build
zsh scripts/build-label-print-mac-app.sh
```

## Git運用

- `main`: Cloudflare Pagesの本番環境
- 作業ブランチ: 変更・確認用。Cloudflareがブランチ別のプレビューURLを作成
- Pull Request: テスト結果とプレビューを確認してから`main`へマージ

基本の更新手順:

```bash
git switch -c feature/変更内容
# 編集後
npm test
npm run build
git add <変更したファイル>
git commit -m "変更内容"
git push -u origin feature/変更内容
```

## Cloudflare Pagesへ公開する

GitHub連携を推奨します。Cloudflare Pagesで次の値を設定します。

| 項目 | 値 |
| --- | --- |
| Gitリポジトリ | `Kond0000/fountain-barcode-converter` |
| Production branch | `main` |
| Framework preset | React (Vite) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js | `.nvmrc`の`22.16.0` |
| 環境変数 | なし |

接続後は`main`へのpushで本番が自動更新され、Pull Requestと作業ブランチにはプレビューURLが作成されます。詳しい初回設定と運用は[Cloudflare Pages公開手順](docs/cloudflare-pages.md)を参照してください。

すでにGit連携済みのPagesプロジェクトへ手動デプロイする場合だけ、次を使用できます。

```bash
npm run deploy:cloudflare
```

## データとプライバシー

- CSV内容はCloudflareや外部APIへ送信せず、ブラウザまたはMacアプリ内で処理します。
- PDFもブラウザまたはMacアプリ内で生成します。
- 直接印刷時はアプリ内でページ別PDFをZIPにまとめて`Downloads`へ保存し、検証後にCUPSへ送信します。
- Cloudflare側に商品データ、PDF、印刷履歴を保存するサーバー機能はありません。
