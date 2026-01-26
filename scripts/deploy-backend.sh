#!/bin/bash

# 後端部署腳本 - FastAPI to Cloud Run
# 使用方式: ./scripts/deploy-backend.sh

set -e

echo "🚀 開始部署後端到 Cloud Run..."

# 設定變數
PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"
SERVICE_NAME="zentropy-backend"

# 切換到 backend 目錄
cd "$(dirname "$0")/../backend"

echo "📦 建置並推送 Docker 映像..."
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

echo "🚢 部署到 Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --port 8080 \
  --set-env-vars "ENVIRONMENT=production" \
  --project ${PROJECT_ID}

echo "✅ 後端部署完成！"
echo "🌐 URL: https://${SERVICE_NAME}-<hash>-${REGION}.run.app"
