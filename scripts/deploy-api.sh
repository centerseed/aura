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
#   - Memory: 512Mi
#   - Database: Neon PostgreSQL (ap-southeast-1)
#   - Embedding: Gemini API (768 維)
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

# 0. 同步 Secrets 到 Secret Manager
log_info "同步 Secrets 到 Secret Manager..."

ENV_FILE="$API_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
    log_error "找不到 $ENV_FILE"
    exit 1
fi

# 從 .env 讀取值的函數
get_env_value() {
    local key=$1
    grep "^${key}=" "$ENV_FILE" | cut -d '=' -f 2- | sed "s/^[\"']//;s/[\"']$//"
}

# 更新 Secret（只在值有變時更新）
sync_secret() {
    local secret_name=$1
    local env_key=$2
    local new_value
    new_value=$(get_env_value "$env_key")

    if [ -z "$new_value" ]; then
        log_warning "跳過 $secret_name: $env_key 未設定"
        return
    fi

    # 檢查 secret 是否存在
    if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" &>/dev/null; then
        log_info "建立新 secret: $secret_name"
        echo -n "$new_value" | gcloud secrets create "$secret_name" \
            --data-file=- \
            --project "$PROJECT_ID" \
            --replication-policy="automatic"
        log_success "$secret_name 已建立"
        return
    fi

    # 取得目前 Secret Manager 的值
    local current_value
    current_value=$(gcloud secrets versions access latest --secret="$secret_name" --project="$PROJECT_ID" 2>/dev/null || echo "")

    # 比較並更新
    if [ "$new_value" != "$current_value" ]; then
        log_info "更新 $secret_name (值已變更)"
        echo -n "$new_value" | gcloud secrets versions add "$secret_name" \
            --data-file=- \
            --project "$PROJECT_ID"
        log_success "$secret_name 已更新"
    else
        log_info "$secret_name 無變更，跳過"
    fi
}

sync_secret "database-url" "DATABASE_URL"
sync_secret "gemini-api-key" "GOOGLE_GENERATIVE_AI_API_KEY"
sync_secret "firebase-admin-key" "FIREBASE_ADMIN_KEY"
sync_secret "google-oauth-client-id" "GOOGLE_OAUTH_CLIENT_ID"
sync_secret "google-oauth-client-secret" "GOOGLE_OAUTH_CLIENT_SECRET"
sync_secret "oauth-encryption-key" "OAUTH_ENCRYPTION_KEY"
sync_secret "ZENTROPY_MCP_JWT_SECRET" "ZENTROPY_MCP_JWT_SECRET"

log_success "Secrets 同步完成"
echo ""

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
IMAGE_REGISTRY="asia-east1-docker.pkg.dev"
IMAGE_REPO="zentropy-images"
IMAGE_TAG="${IMAGE_REGISTRY}/${PROJECT_ID}/${IMAGE_REPO}/${SERVICE_NAME}:latest"

log_info "建置並推送 Docker 映像..."
log_info "Image: ${IMAGE_TAG}"

gcloud builds submit \
    --tag "${IMAGE_TAG}" \
    --project "${PROJECT_ID}" \
    --timeout=20m

log_success "Docker 映像建置完成"

# 5. 部署到 Cloud Run
log_info "部署到 Cloud Run..."

# 基本配置
DEPLOY_ARGS=(
    --image "${IMAGE_TAG}"
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
    --update-secrets GOOGLE_OAUTH_CLIENT_ID=google-oauth-client-id:latest
    --update-secrets GOOGLE_OAUTH_CLIENT_SECRET=google-oauth-client-secret:latest
    --update-secrets OAUTH_ENCRYPTION_KEY=oauth-encryption-key:latest
    --update-secrets ZENTROPY_MCP_JWT_SECRET=ZENTROPY_MCP_JWT_SECRET:latest

    # Node.js 環境變數
    # NEXT_PUBLIC_API_URL 必須指向 API Backend，用於 OAuth Discovery metadata
    --set-env-vars "NODE_ENV=production,GOOGLE_OAUTH_REDIRECT_URI=https://zentropy.cc/api/oauth/callback,NEXT_PUBLIC_FRONTEND_URL=https://zentropy.cc,NEXT_PUBLIC_API_URL=https://zentropy-api-894512935237.asia-east1.run.app"
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
log_info "   - Embedding: Gemini API (零冷啟動)"
log_info "   - ⚠️ Cold start 約 3-5 秒 (Neon 連線)"
echo ""
log_info "📝 下一步:"
log_info "   1. 更新 web/.env.production 中的 API URL:"
log_info "      NEXT_PUBLIC_API_URL=${SERVICE_URL}"
log_info "   2. 部署 Web Frontend:"
log_info "      ./scripts/deploy-web.sh"
echo ""
