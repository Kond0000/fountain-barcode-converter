# LABEL PRINT

任意のCSVヘッダーを動的に解析し、CSV列をラベル項目へ割り当てて、CODE128ラベルPDFをブラウザ内で生成するReact / TypeScript / Viteアプリです。

PDFはmC-Label3の実機解像度8ドット/mm（公称203dpi）に合わせ、mmを実機の整数ドットへ変換してから2倍解像度（16px/mm、約406.4dpi）の白黒画像を生成します。CODE128はデータ長にかかわらず印字可能幅いっぱいに配分し、バー境界とラベル寸法は印刷時に必ず整数ドットになります。

商品名は1行28文字を上限に単語の区切りを優先して改行し、ラベルの実幅に合わせて3.0〜3.2mmの範囲で文字サイズを自動調整します。最小3.0mmでも幅を超える場合は、文字を小さくせずに次の行へ送ります。カラー・サイズ表記（2.8mm）より必ず大きく表示されます。

カラー・サイズと価格は常に別の行へ配置し、価格を右端へ揃えます。割り当てたカラーまたはサイズの値が空欄の場合は「-」を表示します。プレビューとPDFで同じレイアウトを使用します。

商品一覧には割り当て中の項目だけを表示します。ブランド列を割り当てた場合は、商品名の右隣にブランド列と各商品の値が表示されます。

- 公開リポジトリ: <https://github.com/Kond0000/fountain-barcode-converter>
- 本番環境: [Cloudflare Pages](https://fountain-barcode-converter.pages.dev/)（GitHubの`main`ブランチから自動デプロイ）
- CSV処理とPDF生成: 利用者のブラウザ内で完結

## 利用できる機能

| 機能 | Windows | macOS | その他のPC |
| --- | --- | --- | --- |
| CSV読込・ラベル編集・プレビュー | ○ | ○ | ○ |
| PDF保存 | ○ | ○ | ○ |
| mC-Label3へ直接印刷 | - | ○ | - |

Cloudflare上のWebアプリは全員が同じURLから利用できます。通常のPDF保存には追加設定はありません。

mC-Label3への直接印刷だけは、ブラウザからMacのプリンターへ直接アクセスできないため、利用するMacごとにプリンタードライバーとmacOSショートカットを一度設定します。

## 別のMacでmC-Label3直接印刷を設定する

Macごとに次の設定が必要です。

1. mC-Label3のmacOSドライバーをインストールし、プリンターを追加します。
2. macOSの「ショートカット」アプリで`mC-Label3 Print`を作成します。
3. ショートカットの詳細で`共有シートに表示`をオンにします。
4. 「シェルスクリプトを実行」を追加し、次のように設定します。
   - シェル: `/bin/zsh`
   - 入力: `ショートカットの入力`
   - 入力の渡し方: `引数として`
   - 管理者として実行: オフ
5. [scripts/mclabel3-print-example.sh](scripts/mclabel3-print-example.sh)をスクリプト欄へ貼り付けます。
6. 「ショートカット」>「設定」>「詳細」で`スクリプトの実行を許可`をオンにします。
7. Webアプリの「mC-Label3で印刷」を押し、ブラウザからショートカットを開く確認を許可します。

入力欄を空にするとショートカットだけが起動し、印刷ジョブは作成されません。詳しい確認方法とトラブルシューティングは[Macセットアップ手順](docs/macos-mclabel3-shortcut.md)を参照してください。

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

- CSV内容はCloudflareや外部APIへ送信せず、ブラウザ内で処理します。
- PDFもブラウザ内で生成します。
- 直接印刷時はページ別PDFをZIPにまとめて各Macの`Downloads`へ保存し、ローカルのショートカットがCUPSへ送信します。
- Cloudflare側に商品データ、PDF、印刷履歴を保存するサーバー機能はありません。
