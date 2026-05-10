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
以下の変数を Cloud Functions のデプロイ設定に追加してください。
- `GEMINI_API_KEY`: Google AI Studio の API キー
- `CRON_SECRET`: (任意) リクエスト認証用シークレット

## 3. デプロイ手順

### A. フロントエンド (Vercel)
GitHub リポジトリを Vercel に連携してデプロイしてください。フロントエンドの表示と、トリアージ操作（ステータス更新）のみを担当します。

### B. バックエンド (GCP Cloud Functions)
1. `functions/` ディレクトリに移動します。
2. 以下のコマンドでデプロイします（Google Cloud SDK が必要）。
   ```bash
   gcloud functions deploy processFeeds \
     --runtime nodejs20 \
     --trigger-http \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY=your_key,CRON_SECRET=your_secret
   ```
   ※ `--allow-unauthenticated` を使用する場合、`CRON_SECRET` による認証を推奨します。または IAM で Cloud Scheduler のみを許可する構成にしてください。

### C. 定期実行 (GCP Cloud Scheduler)
1. Cloud Scheduler で新しいジョブを作成します。
2. 頻度を `0 6 * * *` (毎日午前6時など) に設定します。
3. ターゲットを `HTTP` とし、Cloud Functions の URL を指定します。
4. Auth ヘッダーに `Bearer <CRON_SECRET>` を設定してください。
