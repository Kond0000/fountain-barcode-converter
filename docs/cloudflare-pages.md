# Cloudflare Pages公開・運用手順

このアプリはサーバー処理やデータベースを使わない静的Viteサイトです。Cloudflare Pagesは`dist`を配信し、CSV解析・PDF生成・印刷ZIP生成は各利用者のブラウザ内で行われます。

## 構成

```text
GitHub: Kond0000/fountain-barcode-converter
  ├─ mainへのpush / merge
  │    └─ Cloudflare Pages本番デプロイ
  └─ 作業ブランチ / Pull Request
       └─ Cloudflare Pagesプレビューデプロイ

利用者のPC
  ├─ 全PC: CSV読込、プレビュー、PDF保存
  └─ 設定済みMac: mC-Label3直接印刷
```

## 初回だけ行うCloudflare設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)へログインします。
2. `Workers & Pages` > `Create application` > `Pages` > `Connect to Git`を開きます。
3. GitHub連携を許可し、`Kond0000/fountain-barcode-converter`を選択します。
4. 次のビルド設定を入力します。

   | 項目 | 値 |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | React (Vite) |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory | `/` |

5. 環境変数は追加せず、`Save and Deploy`を実行します。
6. デプロイ完了後、[https://fountain-barcode-converter.pages.dev/](https://fountain-barcode-converter.pages.dev/)を社内の利用者へ共有します。

CloudflareのGit連携では、`main`以外のブランチにも固有のプレビューURLが作られます。Direct Uploadで作ったPagesプロジェクトは後からGit連携へ切り替えられないため、初回から`Connect to Git`を選択してください。

公式資料:

- [Cloudflare Pages - Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages - Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)

## 通常の更新手順

1. `main`から作業ブランチを作ります。
2. ローカルで`npm test`と`npm run build`を実行します。
3. GitHubへpushしてPull Requestを作ります。
4. CloudflareのプレビューURLでCSV読込、PDF保存、Mac直接印刷を確認します。
5. Pull Requestを`main`へマージします。
6. Cloudflare Pagesの本番デプロイが成功したことを確認します。

GitHub ActionsもpushとPull Requestでテスト・ビルドを実行します。Cloudflareのビルドと両方が成功してから本番へ反映してください。

## 利用者PCの準備

### PDF保存だけを使うPC

Cloudflare PagesのURLをブラウザで開くだけです。ソフトウェアのインストールやGitの設定は不要です。

### mC-Label3へ直接印刷するMac

利用するMacごとに、mC-Label3ドライバーと`mC-Label3 Print`ショートカットを設定します。Cloudflareへ一度デプロイしても、Mac側のショートカットが別のPCへ自動作成されることはありません。

詳細は[macOSショートカット設定](macos-mclabel3-shortcut.md)を参照してください。

## 手動デプロイ

通常はGit連携を使用します。Git連携済みのPagesプロジェクトへ手動で同じ`dist`を送る場合は次を実行します。

```bash
npm ci
npm test
npm run deploy:cloudflare
```

初回はWranglerによるCloudflareログインが求められます。Git連携前に`wrangler pages project create`を実行するとDirect Uploadプロジェクトになるため、このプロジェクトでは使用しません。

## ロールバック

Cloudflare DashboardのPagesプロジェクトで`Deployments`を開き、正常だった過去デプロイを選択してロールバックします。コード側もGitで該当変更をrevertし、`main`と本番内容を一致させます。

## 費用とデータ保存

この構成は静的ファイル配信のみで、Pages Functions、D1、KV、R2を使用しません。小規模な社内利用であればCloudflare PagesのFreeプランから始められます。最新の上限は[Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)で確認してください。

CSV、生成PDF、印刷ZIPはCloudflareへ保存されません。各利用者のブラウザとMacの`Downloads`内だけで処理されます。
