#!/bin/bash

# 前端部署腳本 - Next.js to Cloud Run (使用 Secret Manager)
# 使用方式: ./scripts/deploy-web.sh

set -e

echo "🚀 開始部署前端到 Cloud Run..."

# 設定變數
PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"
SERVICE_NAME="zentropy-web"

# 切換到 web 目錄
cd "$(dirname "$0")/../web"

echo "📦 建置並推送 Docker 映像..."
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME} --project ${PROJECT_ID}

echo "🚢 部署到 Cloud Run (使用 Secret Manager)..."
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --port 8080 \
  --update-secrets DATABASE_URL=database-url:latest,GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest \
  --set-env-vars NODE_ENV=production,NEXT_PUBLIC_FIREBASE_API_KEY=REDACTED_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zentropy-4f7a5.firebaseapp.com,NEXT_PUBLIC_FIREBASE_PROJECT_ID=zentropy-4f7a5,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zentropy-4f7a5.firebasestorage.app,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=894512935237,NEXT_PUBLIC_FIREBASE_APP_ID=1:894512935237:web:2533f9a2e7d09321f88e2c \
  --project ${PROJECT_ID}

echo ""
echo "✅ 前端部署完成！"
echo ""
echo "🌐 取得服務 URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
  --region ${REGION} \
  --project ${PROJECT_ID} \
  --format 'value(status.url)')

echo "📍 服務已部署至: ${SERVICE_URL}"
echo ""
echo "🧪 測試端點:"
echo "   curl ${SERVICE_URL}"
