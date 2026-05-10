# Project: dairy-news-picker

毎朝のRSSフィードの消化を高速化し、週末の精読とNotebookLMへの登録作業を効率化するための個人専用Webアプリケーション。

## 継続開発プロトコル

このプロジェクトは複数のセッションにわたって開発されます。セッション開始時に以下の手順で状況を確認してください。

1.  **進捗の確認**: `docs/progress.md` を読み、現在のフェーズと未完了のタスクを確認する。
2.  **設計の参照**: `requirement.md` および `plans/` フォルダ内の各フェーズ詳細プランを参照する。
3.  **GEMINI.md の遵守**: このファイルに記載された規約とワークフローに従う。

## 開発規約

- **フレームワーク**: Next.js (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **DB**: Firestore
- **LLM**: Gemini 2.5 Flash
- **認証**: Middlewareによる簡易パスワード認証
- **PWA**: iPad横画面に最適化（大きなボタン、タップ領域の確保）

## セッション終了時のアクション

セッションを終了する際は、必ず以下の作業を行ってください：
1.  `docs/progress.md` を更新し、完了したタスクと次に着手すべき内容を明記する。
2.  新しく作成したファイルや重要な変更点を `docs/progress.md` に記録する。

## ディレクトリ構成（予定）

- `src/app`: Next.js App Router
- `src/components`: UIコンポーネント
- `src/lib`: Firestore, Gemini API 等の共通ロジック
- `src/hooks`: カスタムフック
- `src/types`: TypeScript型定義
- `functions/`: GCP Cloud Functions (RSS取得・LLM処理)
- `docs/`: 進捗管理・設計メモ
- `plans/`: フェーズごとの詳細実装プラン
