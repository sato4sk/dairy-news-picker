# Phase 1: プロジェクト初期化 & 認証基盤 実装詳細

## 1. プロジェクト作成
- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` を実行。
- `lucide-react`, `clsx`, `tailwind-merge` などの基本ライブラリを確認。

## 2. shadcn/ui 導入
- `npx shadcn-ui@latest init` で初期化。
- 必要なコンポーネント（Button, Card, Input, Tabs, Toast等）のインストール。

## 3. 認証 (Middleware) の実装
- `.env.local` に `APP_PASSWORD` を定義。
- `src/middleware.ts` を作成：
  - 特定のパス（`/login` 以外）へのアクセス時に Cookie (`auth_session`) の有無を確認。
  - 未認証時は `/login` へリダイレクト。
- `src/app/login/page.tsx` を作成：
  - パスワード入力フォーム。
  - 正解なら Cookie をセットしてトップへ。

## 4. 基本レイアウト作成
- `src/app/layout.tsx`: iPad横画面に最適化した `max-w-screen-xl mx-auto` などの制約。
- グローバルナビゲーション（朝のトリアージ、精読、NotebookLM管理）の骨格。

## 5. 型定義
- `src/types/index.ts` に `Article`, `DailySummary`, `FeedGroup` などの基本型を定義。
