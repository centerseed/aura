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
echo "${GREEN}📦 建置產物位置: .next/${NC}"
echo "${GREEN}🚀 可以開始部署了！${NC}"
echo ""

# 提供部署指令提示
echo "${BLUE}💡 下一步部署指令：${NC}"
echo ""
echo "${YELLOW}   # 部署到 Google Cloud Run (推薦)：${NC}"
echo "   gcloud run deploy zentropy-api \\"
echo "     --source . \\"
echo "     --region asia-east1 \\"
echo "     --project zentropy-4f7a5 \\"
echo "     --platform managed \\"
echo "     --allow-unauthenticated \\"
echo "     --set-env-vars=\"LIBRARIAN_URL=https://librarian-service-yd7nv64yya-de.a.run.app\" \\"
echo "     --set-secrets=\"DATABASE_URL=database-url:latest\" \\"
echo "     --set-secrets=\"GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest\" \\"
echo "     --set-secrets=\"FIREBASE_ADMIN_KEY=firebase-admin-key:latest\" \\"
echo "     --set-secrets=\"LIBRARIAN_API_KEY=librarian-api-key:latest\""
echo ""
echo "${YELLOW}   # 本地啟動生產模式：${NC}"
echo "   npm start"
echo ""

exit 0
