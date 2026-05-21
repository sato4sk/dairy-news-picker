# Project: dairy-news-picker

毎朝のRSSフィードの消化を高速化し、週末の精読とNotebookLMへの登録作業を効率化するための個人専用Webアプリケーション。

## 開発の前提条件 (Mandates)

### 状態管理とデータ整合性
- **`is_triaged` フラグの重視**: バックエンド（Cloud Functions）では、記事が処理済みかどうかを `is_triaged` (Boolean) フィールドで管理します。RSS取得側（`fetchFeeds`）は既存の記事を UPSERT する際、`status` や `is_triaged` フィールドを**書き換えてはいけません**。
- **冪等性の確保**: `fetchFeeds` は `db.getAll()` を使用して既存記事を判定し、新規記事のみ `is_triaged: false` で初期化します。

### Next.js に関する重要事項
- このプロジェクトで使用されている Next.js は、標準的な仕様やファイル構成と異なる点があります。コードを記述する前に必ず `node_modules/next/dist/docs/` の関連ガイドを確認し、非推奨通知には細心の注意を払ってください。

## 技術スタックと規約

- **フレームワーク**: Next.js (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **DB**: Firestore
- **LLM**: Gemini 2.5 Flash / Gemini 3.1 Flash-lite 等
  - `triageArticles` ではモデルのフォールバックロジックが実装されています。
- **認証**: Middlewareによる簡易パスワード認証 (`APP_PASSWORD`)
- **PWA**: iPad横画面に最適化（大きなボタン、タップ領域の確保）

## 開発ワークフロー

### ブランチ戦略
- **機能開発・バグ修正**: 必ず新しいフィーチャーブランチ（例: `feat/issue-<num>-<description>`）を作成して作業を行います。
- **メインブランチへの直接 push 禁止**: `main` ブランチへの直接コミットや push は行わず、必ず Pull Request (PR) を経由します。

### プルリクエスト (Pull Requests)
プルリクエストの作成には GitHub CLI (`gh`) を使用することを標準手順とします。
1. 新しいブランチを作成する: `git checkout -b <branch-name>`
2. 変更を commit する: `git add . && git commit -m "<message>"`
3. ブランチを push する: `git push -u origin <branch-name>`
4. ビルドチェックを行う: `npm run build` を実行し、エラーがないことを確認する
5. PR を作成する: `gh pr create --title "<title>" --body "<body>"` (または `--body-file`)
6. マージ後のブランチ管理: PR がマージされたら、ローカルブランチを削除し、最新の `main` を pull します。

### バックエンド処理 (GCP Cloud Functions)
- **並列化**: フィードの取得はグループ単位で並列実行されます。
- **フィルタ**: RSS取得は過去12時間以内の記事を対象とします。

## ディレクトリ構成

- `src/app`: Next.js App Router
- `src/components`: UIコンポーネント
- `src/lib`: Firestore, Gemini API 等の共通ロジック
- `src/types`: TypeScript型定義
- `functions/`: GCP Cloud Functions (RSS取得・LLM処理)
- `docs/`: 設計メモ（`progress.md` は GitHub Issues に移行したため廃止）
- `plans/`: フェーズごとの詳細実装プラン
- `scripts/`: メンテナンス・移行用ユーティリティ
