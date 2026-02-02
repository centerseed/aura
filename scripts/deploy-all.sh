#!/bin/bash
# ==============================================================================
# deploy-all.sh - 統一部署腳本 (API + Web)
# ==============================================================================
#
# 用途: 一次性部署後端 API 和前端 Web 到生產環境
#
# 使用方式:
#   ./scripts/deploy-all.sh              # 部署到 production
#   ./scripts/deploy-all.sh staging      # 部署到 staging
#
# 部署順序:
#   1. 部署 API 到 Cloud Run
#   2. 取得 API URL
#   3. 更新 web/.env.production (如需要)
#   4. 部署 Web 到 Firebase Hosting
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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
log_info "=========================================="
log_info "   Naruvia 完整部署 (API + Web)"
log_info "=========================================="
echo ""

# 解析環境參數
ENVIRONMENT="${1:-production}"

case "$ENVIRONMENT" in
    staging)
        log_info "部署環境: Staging"
        ;;
    production|prod)
        ENVIRONMENT="production"
        log_info "部署環境: Production"
        ;;
    *)
        log_error "未知環境: $ENVIRONMENT"
        echo ""
        echo "使用方式: $0 [staging|production]"
        exit 1
        ;;
esac

# 1. 部署 API
log_info "=========================================="
log_info "Step 1/2: 部署 API Backend 到 Cloud Run"
log_info "=========================================="
echo ""

"$SCRIPT_DIR/deploy-api.sh" "$ENVIRONMENT"

if [ $? -ne 0 ]; then
    log_error "API 部署失敗，中止流程"
    exit 1
fi

echo ""
log_success "API 部署完成"
echo ""

# 等待幾秒確保服務啟動
log_info "等待服務啟動..."
sleep 5

# 2. 部署 Web
log_info "=========================================="
log_info "Step 2/2: 部署 Web Frontend 到 Firebase Hosting"
log_info "=========================================="
echo ""

log_warning "請確保 web/.env.production 中的 NEXT_PUBLIC_API_URL 已設定正確的 Cloud Run URL"
echo ""

# 詢問是否繼續
read -p "按 Enter 繼續部署 Web，或 Ctrl+C 取消... " -r
echo ""

"$SCRIPT_DIR/deploy-web.sh" "$ENVIRONMENT"

if [ $? -ne 0 ]; then
    log_error "Web 部署失敗"
    exit 1
fi

echo ""
log_success "=========================================="
log_success "   所有服務部署完成！"
log_success "=========================================="
echo ""

# GCP 設定
PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"

if [ "$ENVIRONMENT" = "staging" ]; then
    SERVICE_NAME="zentropy-api-staging"
    WEB_URL="https://staging--zentropy-4f7a5.web.app"
else
    SERVICE_NAME="zentropy-api"
    WEB_URL="https://zentropy-4f7a5.web.app"
fi

# 取得 API URL
API_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format 'value(status.url)' 2>/dev/null || echo "未知")

log_info "📍 部署資訊:"
echo ""
log_info "   API (Cloud Run):      ${API_URL}"
log_info "   Web (Firebase):       ${WEB_URL}"
echo ""
log_info "🧪 測試連接:"
log_info "   curl ${API_URL}/api/me"
log_info "   開啟瀏覽器: ${WEB_URL}"
echo ""
log_info "📊 監控服務:"
log_info "   API:  gcloud run services describe ${SERVICE_NAME} --region ${REGION}"
log_info "   Web:  firebase hosting:channel:list --project zentropy-4f7a5"
echo ""
