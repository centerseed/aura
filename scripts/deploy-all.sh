#!/bin/bash

# 完整部署腳本 - 前端 + 後端
# 使用方式: ./scripts/deploy-all.sh

set -e

PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"

echo "🌟 Zentropy 完整部署流程開始..."
echo "📍 專案: ${PROJECT_ID}"
echo "📍 區域: ${REGION}"
echo ""

# 檢查 gcloud 是否已登入
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
  echo "❌ 請先登入 Google Cloud: gcloud auth login"
  exit 1
fi

# 檢查專案是否已設定
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo "⚙️  設定專案為 ${PROJECT_ID}..."
  gcloud config set project ${PROJECT_ID}
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  部署後端 (FastAPI)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/deploy-backend.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  部署前端 (Next.js)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/deploy-web.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 完整部署完成！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 下一步："
echo "1. 檢查 Cloud Run 服務狀態"
echo "2. 設定環境變數（DATABASE_URL, API Keys 等）"
echo "3. 設定自訂網域（如需要）"
echo ""
echo "🔧 管理指令："
echo "  gcloud run services list --platform managed --region ${REGION}"
echo "  gcloud run services describe zentropy-web --platform managed --region ${REGION}"
echo "  gcloud run services describe zentropy-backend --platform managed --region ${REGION}"
