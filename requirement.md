# 情報収集＆トリアージPWA 要件定義・基本設計書

## 1. プロジェクト概要
*   **目的:** 毎朝のRSSフィードの消化を高速化し、週末の精読とNotebookLMへの登録作業を効率化するための個人専用Webアプリケーション。
*   **ターゲットデバイス:** iPad（横画面・タッチ操作前提）。PWAとしてホーム画面に追加して使用。
*   **主なアプローチ:**
    *   バックエンドでRSSを取得し、LLM（Gemini Flash）で記事を「コア関心」「周辺」「ランダム」に分類＆朝の要約を生成。
    *   フロントエンドでは記事を「後で読む」「NotebookLMプール」「スキップ」に高速でトリアージ。
    *   NotebookLMへの登録は、プールしたURLを10件ずつ一括コピーするUIを提供し、半自動化する。

## 2. 技術スタック
*   **フロントエンド:** Next.js (App Router), React, Tailwind CSS, shadcn/ui (または類似のUIライブラリ)
*   **バックエンド (API / バッチ):**
    *   Next.js Route Handlers (フロントエンドからのAPI用)
    *   GCP Cloud Functions & Cloud Scheduler (毎朝のRSS取得・LLM処理バッチ用)
*   **データベース:** GCP Firestore
*   **LLM API:** Google Gemini API (モデル: `gemini-2.5-flash` 等の最新Flashモデル)
*   **ホスティング:** Vercel

## 3. データ構造 (Firestore)
*   **コレクション:** `articles`
    *   `id`: ドキュメントID (URLのハッシュ等)
    *   `title`: 記事タイトル
    *   `url`: 記事URL
    *   `summary`: LLMが生成した1行要約
    *   `group`: フィードグループ (例: 'general', 'it_news', 'it_blog')
    *   `category`: LLMによる分類 ('core', 'related', 'random')
    *   `status`: 状態フラグ ('in_feed', 'to_read', 'to_notebook', 'done')
    *   `published_at`: 記事公開日時
    *   `queued_at`: 'to_notebook' に変更された日時（一括コピー時の古い順ソート用。null許容）
*   **コレクション:** `daily_summaries`
    *   `id`: 日付文字列 (例: '2026-05-06')
    *   `group`: フィードグループ
    *   `content`: LLMが生成したその日の要約テキスト

## 4. 設定データ (MVPフェーズではハードコード)
`config/feeds.ts` のようなファイルに以下を定義する。
*   **グループ定義:**
    *   `id`: グループID
    *   `name`: 表示名
    *   `keywords`: LLMに分類させるための関心キーワードの配列
    *   `feeds`: RSSフィードURLの配列

## 5. 主要なUIと機能要件
UIはiPadのタッチ操作に最適化（ボタンは大きく、タップ領域を広く）すること。

### A. 朝のトリアージ画面 (メイン画面)
*   **ヘッダー:** 日付選択（デフォルトは今日）と、グループ切り替えタブ。
*   **上部エリア:** 選択中のグループの `daily_summaries` (朝の要約テキスト) を表示。
*   **記事リストエリア:** `status` が 'in_feed' の記事を、`category` (コア/周辺/ランダム) ごとにセクションを分けてリスト/カード表示。
*   **アクション:** 各記事カードに以下の3つの大きなボタン（またはスワイプアクション）を配置。
    *   「後で読む」-> `status` を 'to_read' に更新
    *   「NotebookLM」-> `status` を 'to_notebook' に更新し、`queued_at` に現在時刻をセット
    *   「スキップ」-> `status` を 'done' に更新

### B. 週末の精読画面 (後で読むリスト)
*   `status` が 'to_read' の記事を一覧表示（グループ横断）。
*   タップで別タブにて実サイトを開く。
*   「読了 (アーカイブ) 」ボタンで `status` を 'done' に更新。
*   ここから「やっぱり概要でいい」と判断した場合のために、「NotebookLMへ送る」ボタンも配置（`status`='to_notebook'へ）。

### C. NotebookLM キュー・マネージャー画面
*   `status` が 'to_notebook' の記事を対象とする。
*   **機能:** `queued_at` が古い順に最大10件取得し、そのURLを改行区切りで `readonly` な `textarea` に表示する。
*   **アクションボタン:**
    *   **「Copy URLs」:** テキストエリアの内容をクリップボードにコピー。
    *   **「Done & Next」:** 現在表示されている最大10件の記事の `status` を 'done' に一括更新し、即座に次の10件（あれば）を取得してテキストエリアを更新する。

## 6. 認証 (MVP仕様)
*   Next.jsの `middleware.ts` を使用し、簡易的なパスワード認証を実装する。
*   環境変数 (`APP_PASSWORD`) と入力値が一致した場合のみ、暗号化されたCookieを発行してアクセスを許可する。
*   ※将来的にNextAuth.jsなどへの移行を容易にするため、アプリ内の各ページコンポーネントには認証ロジックを直接記述せず、Middlewareでアクセス制御を完結させること。

## 7. LLM処理の要件 (バッチ処理側)
*   グループごとにRSSを取得後、記事のタイトル・リンク・スニペットを配列にまとめる。
*   Gemini Flashモデルにデータを渡し、JSONスキーマを定義して構造化出力を強制する（`response_mime_type: "application/json"` を利用）。
*   **プロンプト指示事項:**
    1.  設定された `keywords` を元に、記事を 'core' (直結), 'related' (周辺), 'random' (関連しないがITエンジニアとして面白いもの) に分類すること。
    2.  各記事の30文字程度の短い要約を付与すること。
    3.  入力された全記事のトレンドを総括する「朝の要約テキスト」を生成すること。

---

こちらのドキュメントで、不足している観点や修正したい箇所はありますでしょうか？問題なければ、このままAIエディタに投入して開発をスタートできるはずです！