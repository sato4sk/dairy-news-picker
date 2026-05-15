#!/bin/bash

# Configuration
REGION="asia-northeast1"

# Load environment variables if .env.deploy exists
if [ -f .env.deploy ]; then
  export $(grep -v '^#' .env.deploy | xargs)
fi

# Check if required environment variables are set
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT is not set."
  exit 1
fi

SERVICE_ACCOUNT="$GOOGLE_CLOUD_PROJECT@appspot.gserviceaccount.com"

echo "Setting up Cloud Scheduler jobs for project: $GOOGLE_CLOUD_PROJECT"

# 1. fetchFeeds (Every hour)
echo "Creating/Updating fetch-feeds-job..."
gcloud scheduler jobs create http fetch-feeds-job \
  --location=$REGION \
  --schedule="0 * * * *" \
  --uri="https://news-picker-fetch-feeds-699530303342.asia-northeast1.run.app" \
  --http-method=POST \
  --oidc-service-account-email="$SERVICE_ACCOUNT" \
  --message-body="{}" \
  --headers="Content-Type=application/json" \
  --update-if-exists

# 2. triageArticles (Daily at 6 AM JST / 21:00 UTC)
echo "Creating/Updating triage-articles-job..."
gcloud scheduler jobs create http triage-articles-job \
  --location=$REGION \
  --schedule="0 21 * * *" \
  --uri="https://news-picker-triage-articles-699530303342.asia-northeast1.run.app" \
  --http-method=POST \
  --oidc-service-account-email="$SERVICE_ACCOUNT" \
  --message-body="{}" \
  --headers="Content-Type=application/json" \
  --update-if-exists

echo "Cloud Scheduler setup complete."
