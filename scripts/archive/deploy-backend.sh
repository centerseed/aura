#!/bin/bash
# ============================================================================
# deploy-backend.sh - 部署 Backend API 到 Google Cloud Run
# ============================================================================
#
# 使用方式：
#   ./scripts/deploy-backend.sh
#
# 功能：
#   - 建置 Next.js API 專案
#   - 建立 Docker 映像
#   - 推送至 Google Container Registry
#   - 部署至 Cloud Run (按需付費模式)
# ============================================================================

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置變數
PROJECT_ID="zentropy-4f7a5"
SERVICE_NAME="zentropy-api"
REGION="asia-east1"  # 台灣
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
API_DIR="api"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  部署 Zentropy Backend API${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 檢查是否在專案根目錄
if [ ! -d "$API_DIR" ]; then
  echo -e "${RED}錯誤：找不到 api/ 目錄，請在專案根目錄執行此腳本${NC}"
  exit 1
fi

# 2. 切換到 api 目錄
cd "$API_DIR"
echo -e "${GREEN}[1/6] 準備 API 專案...${NC}"

# 3. 安裝依賴 (如果需要)
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}安裝依賴...${NC}"
  npm install
fi

# 4. 生成 Prisma Client
echo -e "${GREEN}[2/6] 生成 Prisma Client...${NC}"
npx prisma generate

# 5. 建置 Next.js
echo -e "${GREEN}[3/6] 建置 Next.js API...${NC}"
npm run build

# 6. 建立 Dockerfile (如果不存在)
if [ ! -f "Dockerfile" ]; then
  echo -e "${YELLOW}創建 Dockerfile...${NC}"
  cat > Dockerfile << 'DOCKERFILE'
FROM node:20-alpine AS base

# 1. 依賴階段
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# 2. 建置階段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. 運行階段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# API 專案不需要 public 目錄，只複製必要的檔案
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
DOCKERFILE
fi

# 7. 建立 .dockerignore (如果不存在)
if [ ! -f ".dockerignore" ]; then
  echo -e "${YELLOW}創建 .dockerignore...${NC}"
  cat > .dockerignore << 'DOCKERIGNORE'
node_modules
.next
.env.local
.git
.gitignore
README.md
npm-debug.log
DOCKERIGNORE
fi

# 8. 使用 Cloud Build 建立映像（在雲端建置，避免架構問題）
echo -e "${GREEN}[4/5] 使用 Cloud Build 建立映像...${NC}"
echo -e "${YELLOW}提示：使用 Cloud Build 可確保正確的 amd64 架構，避免本地 buildx 問題${NC}"
gcloud builds submit --tag "$IMAGE_NAME:latest" .

# 9. 部署至 Cloud Run
echo -e "${GREEN}[5/5] 部署至 Cloud Run...${NC}"
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 3001 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 60s \
  --set-env-vars "NODE_ENV=production" \
  --update-secrets "DATABASE_URL=database-url:latest" \
  --update-secrets "GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest" \
  --update-secrets "FIREBASE_ADMIN_KEY=firebase-admin-key:latest" \
  --project "$PROJECT_ID"

# 11. 獲取服務 URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --format 'value(status.url)')

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}API URL:${NC} $SERVICE_URL"
echo -e "${BLUE}範例:${NC} $SERVICE_URL/api/me"
echo ""
echo -e "${YELLOW}注意：${NC}"
echo -e "  - Cloud Run 採用按需付費模式"
echo -e "  - min-instances=0 表示無流量時自動縮減至 0"
echo -e "  - 環境變數已從 Secret Manager 自動設定："
echo -e "    ✓ DATABASE_URL"
echo -e "    ✓ GOOGLE_GENERATIVE_AI_API_KEY"
echo -e "    ✓ FIREBASE_ADMIN_KEY"
echo ""
