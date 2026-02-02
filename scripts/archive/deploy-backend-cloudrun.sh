#!/bin/bash

# 後端部署腳本 - Next.js API Routes to Cloud Run (按需付費)
# 使用方式: ./scripts/deploy-backend-cloudrun.sh [staging|production]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/web"

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo ""
log_info "======================================"
log_info "   Naruvia API - Cloud Run 部署"
log_info "======================================"
echo ""

# 解析環境參數
ENVIRONMENT="${1:-production}"

# GCP 設定
PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"

case "$ENVIRONMENT" in
    staging)
        SERVICE_NAME="naruvia-api-staging"
        log_info "部署環境: Staging"
        ;;
    production|prod)
        SERVICE_NAME="naruvia-api"
        log_info "部署環境: Production"
        ;;
    *)
        log_error "未知環境: $ENVIRONMENT"
        echo ""
        echo "使用方式: $0 [staging|production]"
        exit 1
        ;;
esac

# 檢查 gcloud CLI
if ! command -v gcloud &> /dev/null; then
    log_error "Google Cloud SDK 未安裝"
    log_info "請訪問: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 切換到 web 目錄
cd "$WEB_DIR"

# 1. 檢查 Dockerfile
if [ ! -f "Dockerfile" ]; then
    log_error "找不到 Dockerfile"
    log_info "請在 web/ 目錄下建立 Dockerfile"
    exit 1
fi

# 2. 建置並推送 Docker 映像
log_info "建置並推送 Docker 映像..."
log_info "Image: gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

gcloud builds submit \
    --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
    --project ${PROJECT_ID} \
    --timeout=20m

log_success "Docker 映像建置完成"

# 3. 部署到 Cloud Run (按需付費配置)
log_info "部署到 Cloud Run..."

# 基本配置
DEPLOY_ARGS=(
    --image "gcr.io/${PROJECT_ID}/${SERVICE_NAME}"
    --platform managed
    --region "${REGION}"
    --project "${PROJECT_ID}"

    # 按需付費核心配置
    --min-instances 0
    --max-instances 10
    --cpu 1
    --memory 512Mi
    --timeout 300
    --concurrency 80

    # 網路配置
    --port 8080
    --allow-unauthenticated

    # 環境變數 (使用 Secret Manager)
    --update-secrets DATABASE_URL=database-url:latest
    --update-secrets GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest
    --update-secrets FIREBASE_ADMIN_KEY=firebase-admin-key:latest

    # Next.js 公開環境變數
    --set-env-vars NODE_ENV=production
    --set-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=REDACTED_FIREBASE_API_KEY
    --set-env-vars NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zentropy-4f7a5.firebaseapp.com
    --set-env-vars NEXT_PUBLIC_FIREBASE_PROJECT_ID=zentropy-4f7a5
    --set-env-vars NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=zentropy-4f7a5.firebasestorage.app
    --set-env-vars NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=894512935237
    --set-env-vars NEXT_PUBLIC_FIREBASE_APP_ID=1:894512935237:web:2533f9a2e7d09321f88e2c
)

if [ "$ENVIRONMENT" = "staging" ]; then
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=staging)
else
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=production)
fi

gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_ARGS[@]}"

log_success "部署完成！"

# 4. 取得服務 URL
echo ""
log_info "取得服務資訊..."

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format 'value(status.url)')

echo ""
log_success "======================================"
log_success "   部署成功！"
log_success "======================================"
echo ""
log_info "📍 服務 URL: ${SERVICE_URL}"
echo ""
log_info "🧪 測試 API:"
log_info "   curl ${SERVICE_URL}/api/me"
echo ""
log_info "💰 計費資訊:"
log_info "   - 最小實例數: 0 (完全按需付費)"
log_info "   - 最大實例數: 10"
log_info "   - 記憶體: 512Mi"
log_info "   - CPU: 1"
log_info "   - 閒置時自動縮減至 0，無請求時不收費"
echo ""
log_info "📊 監控服務:"
log_info "   gcloud run services describe ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID}"
echo ""
