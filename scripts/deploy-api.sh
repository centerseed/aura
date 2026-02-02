#!/bin/bash
# ==============================================================================
# deploy-api.sh - 部署 API Backend 到 Google Cloud Run
# ==============================================================================
#
# 用途: 將後端 API (api/) 部署到 Google Cloud Run
#
# 使用方式:
#   ./scripts/deploy-api.sh              # 部署到 production
#   ./scripts/deploy-api.sh staging      # 部署到 staging
#
# 部署配置:
#   - Platform: Google Cloud Run
#   - Min Instances: 0 (按需付費)
#   - Max Instances: 10
#   - Database: Remote Supabase (PostgreSQL)
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/api"

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
        SERVICE_NAME="zentropy-api-staging"
        log_info "部署環境: Staging"
        ;;
    production|prod)
        SERVICE_NAME="zentropy-api"
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

# 檢查是否登入 GCP
log_info "檢查 GCP 登入狀態..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    log_warning "未登入 GCP，開始登入流程..."
    gcloud auth login
fi

# 設定專案
log_info "設定 GCP 專案: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

# 切換到 api 目錄
cd "$API_DIR"

# 1. 執行 TypeScript 檢查
log_info "執行 TypeScript 檢查..."
npx tsc --noEmit || log_warning "TypeScript 檢查發現問題，繼續部署..."

# 2. 執行測試 (僅 production 環境)
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "執行單元測試..."
    npm run test:unit || {
        log_error "測試失敗，中止部署"
        exit 1
    }
    log_success "測試通過"
fi

# 3. 檢查 Dockerfile
if [ ! -f "Dockerfile" ]; then
    log_error "找不到 api/Dockerfile"
    log_info "請在 api/ 目錄下建立 Dockerfile"
    exit 1
fi

# 4. 建置並推送 Docker 映像
log_info "建置並推送 Docker 映像..."
log_info "Image: gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

gcloud builds submit \
    --tag "gcr.io/${PROJECT_ID}/${SERVICE_NAME}" \
    --project "${PROJECT_ID}" \
    --timeout=20m

log_success "Docker 映像建置完成"

# 5. 部署到 Cloud Run
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
    --port 3001
    --allow-unauthenticated

    # 環境變數 (使用 Secret Manager)
    --update-secrets DATABASE_URL=database-url:latest
    --update-secrets GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest
    --update-secrets FIREBASE_ADMIN_KEY=firebase-admin-key:latest

    # Node.js 環境變數
    --set-env-vars NODE_ENV=production
)

if [ "$ENVIRONMENT" = "staging" ]; then
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=staging)
else
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=production)
fi

gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_ARGS[@]}"

log_success "部署完成！"

# 6. 取得服務 URL
echo ""
log_info "取得服務資訊..."

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format 'value(status.url)')

echo ""
log_success "======================================"
log_success "   API 部署成功！"
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
log_info "📝 下一步:"
log_info "   1. 更新 web/.env.production 中的 API URL:"
log_info "      NEXT_PUBLIC_API_URL=${SERVICE_URL}"
log_info "   2. 部署 Web Frontend:"
log_info "      ./scripts/deploy-web.sh"
echo ""
