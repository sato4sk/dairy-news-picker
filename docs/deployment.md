# デプロイ・定期実行ガイド (GCP 構成)

本アプリケーションは、**Next.js (Vercel)** によるフロントエンド UI と、**GCP Cloud Functions** によるバックエンド処理のハイブリッド構成です。

## 1. 構成概要
- **Vercel (Frontend)**: Next.js アプリを表示。Firestore からデータを読み書きします。
- **GCP Cloud Functions (Backend)**: 定期的に RSS を取得し、Gemini API で分類・要約して Firestore に保存します。
- **GCP Firestore**: フロントエンドとバックエンドの共通データベース。

## 2. 環境変数設定

### Vercel (Next.js)
以下の変数を Vercel のプロジェクト設定に追加してください。
- `APP_PASSWORD`: アプリへのログインパスワード
- `FIREBASE_PROJECT_ID`: Firebase プロジェクト ID
- `FIREBASE_CLIENT_EMAIL`: サービスアカウントのメールアドレス
- `FIREBASE_PRIVATE_KEY`: サービスアカウントの秘密鍵 (`\n`を含む文字列)

### GCP Cloud Functions
以下の変数を Cloud Functions の設定に追加してください。
- `GEMINI_API_KEY`: Google AI Studio の API キー
- `CRON_SECRET`: (任意) リクエスト認証用シークレット

## 3. デプロイ手順 (Web コンソール版)

### A. フロントエンド (Vercel)
GitHub リポジトリを Vercel に連携してデプロイしてください。

### B. バックエンド (GCP Cloud Functions)
### B. バックエンド (GCP Cloud Functions)
セキュリティを確保するため、**IAM 認証**を用いて Cloud Scheduler からのみ実行を許可する設定にします。

#### 1. 関数「fetchFeeds」の作成 (収集用)
*   **環境**: `第2世代`
*   **関数名**: `fetchFeeds`
*   **リージョン**: `asia-northeast1`
*   **トリガー**: `HTTPS` (認証が必要)
*   **エントリポイント**: `fetchFeeds`
*   **ランタイム環境変数**: なし (必要に応じて CRON_SECRET)

#### 2. 関数「triageArticles」の作成 (トリアージ用)
*   **環境**: `第2世代`
*   **関数名**: `triageArticles`
*   **リージョン**: `asia-northeast1`
*   **トリガー**: `HTTPS` (認証が必要)
*   **エントリポイント**: `triageArticles`
*   **タイムアウト**: `300秒` (処理件数が多い場合に備えて長めに設定を推奨)
*   **ランタイム環境変数**: `GEMINI_API_KEY`, `CRON_SECRET`

### C. 定期実行 (GCP Cloud Scheduler)

#### 1. 収集ジョブ (fetchFeeds)
*   **頻度**: `0 * * * *` (1時間おき)
*   **URL**: `fetchFeeds` の URL
*   **HTTP メソッド**: `POST`
*   **Auth 設定**: `OIDC トークンを追加` (サービスアカウントに「Cloud Functions 起動元」権限が必要)

#### 2. トリアージジョブ (triageArticles)
*   **頻度**: `0 6 * * *` (毎日午前6時)
*   **URL**: `triageArticles` の URL
*   **HTTP メソッド**: `POST`
*   **Auth 設定**: `OIDC トークンを追加`


これで、外部からの直接アクセスは拒否され、Cloud Scheduler (IAM トークンを持つ) からのみ実行可能な安全な構成になります。
