#!/bin/bash

# Configuration
REGION="asia-northeast1"
RUNTIME="nodejs22"
MEMORY="512Mi"
TIMEOUT="300"

# Load environment variables if .env.deploy exists
if [ -f .env.deploy ]; then
  export $(grep -v '^#' .env.deploy | xargs)
fi

# Check if required environment variables are set
if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT is not set."
  echo "Please set it in .env.deploy or your environment."
  exit 1
fi

if [ -z "$GEMINI_API_KEY" ]; then
  echo "Warning: GEMINI_API_KEY is not set. triageArticles might fail if not already set on the function."
fi

echo "Deploying functions to project: $GOOGLE_CLOUD_PROJECT in region: $REGION"

echo "----------------------------------------"
echo "Running pre-deploy checks..."
npm run verify
npm --prefix functions test

# 1. Deploy fetchFeeds
echo "----------------------------------------"
echo "Deploying news-picker-fetch-feeds (Cloud Run function)..."
gcloud run deploy news-picker-fetch-feeds \
  --source=./functions \
  --function=fetchFeeds \
  --base-image=nodejs22 \
  --region=$REGION \
  --cpu=1 \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --no-allow-unauthenticated

# 2. Deploy triageArticles
echo "----------------------------------------"
echo "Deploying news-picker-triage-articles (Cloud Run function)..."
gcloud run deploy news-picker-triage-articles \
  --source=./functions \
  --function=triageArticles \
  --base-image=nodejs22 \
  --region=$REGION \
  --cpu=1 \
  --memory=$MEMORY \
  --timeout=$TIMEOUT \
  --no-allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=$GEMINI_API_KEY"


echo "----------------------------------------"
echo "Deployment complete."
echo ""
echo "Note: To setup Cloud Scheduler jobs, you can use the following commands:"
echo ""
echo "1. fetchFeeds (Every hour):"
echo "gcloud scheduler jobs create http fetch-feeds-job --schedule=\"0 * * * *\" --uri=\"https://$REGION-$GOOGLE_CLOUD_PROJECT.cloudfunctions.net/fetchFeeds\" --http-method=POST --oidc-service-account-email=\"$GOOGLE_CLOUD_PROJECT@appspot.gserviceaccount.com\" --location=$REGION"
echo ""
echo "2. triageArticles (Daily at 6 AM JST / 21:00 UTC):"
echo "gcloud scheduler jobs create http triage-articles-job --schedule=\"0 21 * * *\" --uri=\"https://$REGION-$GOOGLE_CLOUD_PROJECT.cloudfunctions.net/triageArticles\" --http-method=POST --oidc-service-account-email=\"$GOOGLE_CLOUD_PROJECT@appspot.gserviceaccount.com\" --location=$REGION"
