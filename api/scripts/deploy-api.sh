#!/bin/bash

# 部署 API 前的完整檢查腳本
# 確保所有測試通過、覆蓋率達標、程式碼可建置

set -e  # 遇到錯誤立即停止

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 步驟計數器
STEP=1
TOTAL_STEPS=6

echo ""
echo "${BLUE}========================================${NC}"
echo "${BLUE}   API 部署前檢查流程${NC}"
echo "${BLUE}========================================${NC}"
echo ""

# Step 1: 檢查環境變數
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 檢查必要的環境變數..."
STEP=$((STEP+1))

if [ -z "$DATABASE_URL" ]; then
  echo "${YELLOW}⚠️  DATABASE_URL 未設置（生產環境需要）${NC}"
fi

if [ -z "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
  echo "${RED}❌ GOOGLE_GENERATIVE_AI_API_KEY 未設置${NC}"
  echo "${RED}   請在 .env 檔案中設置此環境變數${NC}"
  exit 1
fi

if [ -z "$LIBRARIAN_URL" ]; then
  echo "${YELLOW}⚠️  LIBRARIAN_URL 未設置（Librarian Service 學習功能需要）${NC}"
fi

if [ -z "$LIBRARIAN_API_KEY" ]; then
  echo "${YELLOW}⚠️  LIBRARIAN_API_KEY 未設置（Librarian Service 學習功能需要）${NC}"
fi

echo "${GREEN}✅ 環境變數檢查通過${NC}"
echo ""

# Step 2: 安裝依賴
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 檢查 npm 依賴..."
STEP=$((STEP+1))

if [ ! -d "node_modules" ]; then
  echo "${YELLOW}⚠️  node_modules 不存在，正在安裝依賴...${NC}"
  npm ci
else
  echo "${GREEN}✅ 依賴已安裝${NC}"
fi
echo ""

# Step 3: 運行 Linter
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 運行程式碼檢查 (Linter)..."
STEP=$((STEP+1))

if npm run lint; then
  echo "${GREEN}✅ Linter 檢查通過${NC}"
else
  echo "${RED}❌ Linter 檢查失敗${NC}"
  echo "${RED}   請修復程式碼風格問題後再部署${NC}"
  exit 1
fi
echo ""

# Step 4: 運行單元測試
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 運行單元測試..."
STEP=$((STEP+1))

if npm run test:unit; then
  echo "${GREEN}✅ 單元測試通過${NC}"
else
  echo "${RED}❌ 單元測試失敗${NC}"
  echo "${RED}   請修復測試後再部署${NC}"
  exit 1
fi
echo ""

# Step 5: 運行整合測試（跳過 Embedding API 測試以節省配額）
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 運行整合測試..."
STEP=$((STEP+1))

echo "${YELLOW}ℹ️  啟動測試資料庫...${NC}"
if npm run test:db:setup; then
  echo "${GREEN}✅ 測試資料庫已啟動${NC}"
else
  echo "${RED}❌ 測試資料庫啟動失敗${NC}"
  echo "${RED}   請檢查 Docker 是否運行${NC}"
  exit 1
fi

echo "${YELLOW}ℹ️  執行整合測試（跳過 Embedding API 測試）...${NC}"
if SKIP_EMBEDDING_TESTS=true npm run test:integration; then
  echo "${GREEN}✅ 整合測試通過${NC}"
else
  echo "${RED}❌ 整合測試失敗${NC}"
  echo "${RED}   請修復測試後再部署${NC}"
  npm run test:db:stop
  exit 1
fi

# 停止測試資料庫
npm run test:db:stop
echo ""

# Step 6: 檢查測試覆蓋率
echo "${BLUE}[$STEP/$TOTAL_STEPS]${NC} 檢查測試覆蓋率..."
STEP=$((STEP+1))

echo "${YELLOW}ℹ️  生成覆蓋率報告...${NC}"
if npm run test:coverage > /tmp/coverage-output.txt 2>&1; then
  echo "${GREEN}✅ 測試覆蓋率檢查通過${NC}"

  # 提取覆蓋率數據
  if grep -q "All files" /tmp/coverage-output.txt; then
    echo ""
    echo "${BLUE}📊 覆蓋率摘要：${NC}"
    grep "All files" /tmp/coverage-output.txt
    echo ""
  fi
else
  echo "${RED}❌ 測試覆蓋率未達標${NC}"
  echo "${RED}   請檢查 vitest.config.ts 中的 thresholds 設定${NC}"
  cat /tmp/coverage-output.txt
  exit 1
fi

# Step 7: 建置專案
echo "${BLUE}[7/7]${NC} 建置專案..."

if npm run build; then
  echo "${GREEN}✅ 建置成功${NC}"
else
  echo "${RED}❌ 建置失敗${NC}"
  echo "${RED}   請修復建置錯誤後再部署${NC}"
  exit 1
fi
echo ""

# 部署準備完成
echo "${GREEN}========================================${NC}"
echo "${GREEN}   ✅ 所有檢查通過！${NC}"
echo "${GREEN}========================================${NC}"
echo ""

# ============================================================================
# 部署設定（🚨 只能部署到 zentropy-4f7a5）
# ============================================================================
DEPLOY_PROJECT="zentropy-4f7a5"
DEPLOY_SERVICE="zentropy-api"
DEPLOY_REGION="asia-east1"
DEPLOY_IMAGE="asia-east1-docker.pkg.dev/${DEPLOY_PROJECT}/zentropy-images/${DEPLOY_SERVICE}:latest"
LIBRARIAN_URL="https://librarian-service-isakqhri2a-de.a.run.app"

# 安全檢查：確認 project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$DEPLOY_PROJECT" ]; then
  echo "${YELLOW}⚠️  當前 project 是 ${CURRENT_PROJECT}，切換到 ${DEPLOY_PROJECT}...${NC}"
  gcloud config set project "$DEPLOY_PROJECT"
fi

echo "${BLUE}🚀 開始部署到 Cloud Run${NC}"
echo "   Project:  ${DEPLOY_PROJECT}"
echo "   Service:  ${DEPLOY_SERVICE}"
echo "   Region:   ${DEPLOY_REGION}"
echo ""

# Step 1: Build & Push Docker image
echo "${BLUE}🐳 建置 Docker image...${NC}"
gcloud builds submit --tag "$DEPLOY_IMAGE" --project "$DEPLOY_PROJECT" .

# Step 2: Deploy to Cloud Run
echo "${BLUE}☁️  部署到 Cloud Run...${NC}"
gcloud run deploy "$DEPLOY_SERVICE" \
  --image "$DEPLOY_IMAGE" \
  --region "$DEPLOY_REGION" \
  --project "$DEPLOY_PROJECT" \
  --platform managed \
  --allow-unauthenticated \
  --update-env-vars "LIBRARIAN_URL=${LIBRARIAN_URL}" \
  --update-secrets "DATABASE_URL=database-url:latest,GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest,FIREBASE_ADMIN_KEY=firebase-admin-key:latest,LIBRARIAN_API_KEY=librarian-api-key:latest,OAUTH_ENCRYPTION_KEY=oauth-encryption-key:latest,GOOGLE_OAUTH_CLIENT_ID=google-oauth-client-id:latest,GOOGLE_OAUTH_CLIENT_SECRET=google-oauth-client-secret:latest"

echo ""
echo "${GREEN}✅ 部署完成！${NC}"
SERVICE_URL=$(gcloud run services describe "$DEPLOY_SERVICE" \
  --region "$DEPLOY_REGION" --project "$DEPLOY_PROJECT" --format 'value(status.url)')
echo "   URL: ${SERVICE_URL}"
echo ""

# Step 3: 清理舊 container images（保留最近 2 個）
echo "${BLUE}🧹 清理舊 container images（保留最近 2 個）...${NC}"
REPO_PATH="asia-east1-docker.pkg.dev/${DEPLOY_PROJECT}/zentropy-images/${DEPLOY_SERVICE}"
OLD_DIGESTS=$(gcloud artifacts docker images list "$REPO_PATH" \
  --project "$DEPLOY_PROJECT" \
  --sort-by="~UPDATE_TIME" \
  --format="value(version)" \
  --limit=999 2>/dev/null | tail -n +3)

if [ -n "$OLD_DIGESTS" ]; then
  DELETED=0
  for DIGEST in $OLD_DIGESTS; do
    echo "   刪除: ${DIGEST:0:20}..."
    gcloud artifacts docker images delete "${REPO_PATH}@${DIGEST}" \
      --project "$DEPLOY_PROJECT" --quiet 2>/dev/null && DELETED=$((DELETED+1)) || true
  done
  echo "${GREEN}✅ 已清理 ${DELETED} 個舊 image${NC}"
else
  echo "${GREEN}✅ 沒有需要清理的舊 image${NC}"
fi
echo ""

exit 0
