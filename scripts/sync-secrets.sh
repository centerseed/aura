#!/bin/bash
# ==============================================================================
# sync-secrets.sh - 同步本地 .env 到 Google Secret Manager
# ==============================================================================
#
# 用途: 從本地 .env 讀取敏感資訊並更新到 Secret Manager
#
# 使用方式:
#   ./scripts/sync-secrets.sh           # 使用 api/.env
#   ./scripts/sync-secrets.sh staging   # 使用 api/.env.staging
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

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# GCP 設定
PROJECT_ID="zentropy-4f7a5"

# 選擇 .env 文件
ENVIRONMENT="${1:-production}"
case "$ENVIRONMENT" in
    staging)
        ENV_FILE="$PROJECT_ROOT/api/.env.staging"
        ;;
    production|prod)
        ENV_FILE="$PROJECT_ROOT/api/.env"
        ;;
    *)
        log_error "未知環境: $ENVIRONMENT"
        exit 1
        ;;
esac

if [ ! -f "$ENV_FILE" ]; then
    log_error "找不到環境檔案: $ENV_FILE"
    exit 1
fi

echo ""
log_info "======================================"
log_info "   同步 Secrets 到 Secret Manager"
log_info "======================================"
log_info "環境檔案: $ENV_FILE"
echo ""

# 讀取 .env 並提取值（不顯示在終端）
get_env_value() {
    local key=$1
    grep "^${key}=" "$ENV_FILE" | cut -d '=' -f 2- | sed 's/^["'\'']//;s/["'\'']$//'
}

# 更新 Secret
update_secret() {
    local secret_name=$1
    local env_key=$2
    local value
    value=$(get_env_value "$env_key")

    if [ -z "$value" ]; then
        log_warning "跳過 $secret_name: $env_key 未設定"
        return
    fi

    log_info "更新 $secret_name..."

    # 檢查 secret 是否存在
    if ! gcloud secrets describe "$secret_name" --project "$PROJECT_ID" &>/dev/null; then
        log_info "建立新 secret: $secret_name"
        echo -n "$value" | gcloud secrets create "$secret_name" \
            --data-file=- \
            --project "$PROJECT_ID" \
            --replication-policy="automatic"
    else
        echo -n "$value" | gcloud secrets versions add "$secret_name" \
            --data-file=- \
            --project "$PROJECT_ID"
    fi

    log_success "$secret_name 已更新"
}

# 同步各個 secrets
update_secret "database-url" "DATABASE_URL"
update_secret "gemini-api-key" "GOOGLE_GENERATIVE_AI_API_KEY"
update_secret "firebase-admin-key" "FIREBASE_ADMIN_KEY"

echo ""
log_success "======================================"
log_success "   Secrets 同步完成！"
log_success "======================================"
echo ""
log_info "現在可以部署:"
log_info "   ./scripts/deploy-api.sh"
echo ""
