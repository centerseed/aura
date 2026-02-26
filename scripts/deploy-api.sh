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
#   - Database: Google Cloud SQL (zentropy-4f7a5:asia-east1:zentropy-db)
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

# DATABASE_URL 生產版：Cloud Run 用 Unix socket，覆蓋 .env 中的本地 TCP URL
CLOUDSQL_NARUVIA_PW=$(get_env_value "CLOUDSQL_DATABASE_URL" | sed 's|.*://[^:]*:\([^@]*\)@.*|\1|')
PROD_DATABASE_URL="postgresql://naruvia_api:${CLOUDSQL_NARUVIA_PW}@localhost/neondb?host=/cloudsql/zentropy-4f7a5:asia-east1:zentropy-db"
if [ -n "$CLOUDSQL_NARUVIA_PW" ]; then
    # 直接同步生產 URL（不讀 .env 的 DATABASE_URL）
    CURRENT_DB=$(gcloud secrets versions access latest --secret="database-url" --project="$PROJECT_ID" 2>/dev/null || echo "")
    if [ "$PROD_DATABASE_URL" != "$CURRENT_DB" ]; then
        log_info "更新 database-url (Cloud SQL Unix socket URL)"
        echo -n "$PROD_DATABASE_URL" | gcloud secrets versions add "database-url" \
            --data-file=- --project "$PROJECT_ID"
        log_success "database-url 已更新"
    else
        log_info "database-url 無變更，跳過"
    fi
else
    log_warning "CLOUDSQL_DATABASE_URL 未設定，跳過 database-url 同步"
fi
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

# 4. 自動遞增版號
VERSION_FILE="$API_DIR/version.json"
if [ -f "$VERSION_FILE" ]; then
    OLD_API_VER=$(python3 -c "import json; print(json.load(open('$VERSION_FILE'))['api'])")
    OLD_MCP_VER=$(python3 -c "import json; print(json.load(open('$VERSION_FILE'))['mcp'])")
    NEW_API_VER=$((OLD_API_VER + 1))
    NEW_MCP_VER=$((OLD_MCP_VER + 1))
    echo "{\"api\": $NEW_API_VER, \"mcp\": $NEW_MCP_VER}" > "$VERSION_FILE"
    log_success "版號更新: api $OLD_API_VER → $NEW_API_VER, mcp $OLD_MCP_VER → $NEW_MCP_VER"
else
    log_warning "找不到 version.json，跳過版號更新"
fi

# 5. 建置並推送 Docker 映像
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

# 6. 部署到 Cloud Run
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

    # Cloud SQL 連線（透過 Unix socket）
    --add-cloudsql-instances "zentropy-4f7a5:asia-east1:zentropy-db"

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
    --update-secrets CALENDAR_WEBHOOK_SECRET=calendar-webhook-secret:latest

    # Node.js 環境變數
    # NEXT_PUBLIC_API_URL 必須指向 API Backend，用於 OAuth Discovery metadata
    --set-env-vars "NODE_ENV=production,GOOGLE_OAUTH_REDIRECT_URI=https://api.zentropy.cc/api/oauth/callback,NEXT_PUBLIC_FRONTEND_URL=https://zentropy.cc,NEXT_PUBLIC_API_URL=https://api.zentropy.cc,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=zentropy-4f7a5.firebaseapp.com,NEXT_PUBLIC_FIREBASE_PROJECT_ID=zentropy-4f7a5"
    --update-secrets NEXT_PUBLIC_FIREBASE_API_KEY=firebase-web-api-key:latest
)

if [ "$ENVIRONMENT" = "staging" ]; then
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=staging)
else
    DEPLOY_ARGS+=(--set-env-vars ENVIRONMENT=production)
fi

gcloud run deploy "${SERVICE_NAME}" "${DEPLOY_ARGS[@]}"

log_success "部署完成！"

# 7. 清理舊的 Docker images (只保留最新兩個)
log_info "清理舊的 Docker images..."

IMAGE_PATH="${IMAGE_REGISTRY}/${PROJECT_ID}/${IMAGE_REPO}/${SERVICE_NAME}"

# 列出所有 digest，按建立時間排序（最新的在前）
DIGESTS=$(gcloud artifacts docker images list "${IMAGE_PATH}" \
    --include-tags \
    --format="value(digest)" \
    --sort-by="~CREATE_TIME" \
    --project="${PROJECT_ID}" \
    2>/dev/null || echo "")

if [ -z "$DIGESTS" ]; then
    log_warning "找不到任何 image，跳過清理"
else
    # 計算總數
    TOTAL_IMAGES=$(echo "$DIGESTS" | wc -l | tr -d ' ')
    log_info "找到 $TOTAL_IMAGES 個 image"

    # 保留最新兩個，刪除其他
    if [ "$TOTAL_IMAGES" -gt 2 ]; then
        IMAGES_TO_DELETE=$(echo "$DIGESTS" | tail -n +3)
        DELETE_COUNT=$(echo "$IMAGES_TO_DELETE" | wc -l | tr -d ' ')

        log_info "刪除 $DELETE_COUNT 個舊 image（保留最新 2 個）..."

        echo "$IMAGES_TO_DELETE" | while read -r digest; do
            if [ -n "$digest" ]; then
                log_info "刪除: ${IMAGE_PATH}@${digest}"
                gcloud artifacts docker images delete \
                    "${IMAGE_PATH}@${digest}" \
                    --quiet \
                    --project="${PROJECT_ID}" 2>/dev/null || log_warning "刪除失敗: ${digest}"
            fi
        done

        log_success "清理完成，已保留最新 2 個 image"
    else
        log_info "只有 $TOTAL_IMAGES 個 image，無需清理"
    fi
fi

echo ""

# 8. 取得服務 URL
echo ""
log_info "取得服務資訊..."

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" \
    --region "${REGION}" \
    --project "${PROJECT_ID}" \
    --format 'value(status.url)')

# 9. 自動 smoke test：確認 /health 回應且 DB 連線正常
log_info "執行 smoke test..."
MAX_RETRIES=5
RETRY_DELAY=5
HEALTH_OK=false

for i in $(seq 1 $MAX_RETRIES); do
    log_info "第 ${i}/${MAX_RETRIES} 次嘗試 ${SERVICE_URL}/health ..."
    HEALTH_RESPONSE=$(curl -sf --max-time 15 "${SERVICE_URL}/health" 2>/dev/null || echo "")

    if [ -n "$HEALTH_RESPONSE" ]; then
        DB_STATUS=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('db','unknown'))" 2>/dev/null || echo "parse_error")
        VERSION=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); v=d.get('version',{}); print(f\"api={v.get('api','?')}\")" 2>/dev/null || echo "?")
        DB_LATENCY=$(echo "$HEALTH_RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('dbLatencyMs','?'))" 2>/dev/null || echo "?")

        if [ "$DB_STATUS" = "ok" ]; then
            log_success "Smoke test 通過！DB 連線正常 (latency: ${DB_LATENCY}ms, ${VERSION})"
            HEALTH_OK=true
            break
        else
            log_error "DB 狀態異常: $DB_STATUS"
            log_warning "完整回應: $HEALTH_RESPONSE"
            break
        fi
    else
        log_warning "服務尚未就緒，等待 ${RETRY_DELAY}s..."
        sleep $RETRY_DELAY
    fi
done

if [ "$HEALTH_OK" != "true" ]; then
    log_error "Smoke test 失敗！請檢查 Cloud Run logs:"
    log_error "  gcloud run logs read ${SERVICE_NAME} --region ${REGION} --project ${PROJECT_ID} --limit 50"
    exit 1
fi

echo ""
log_success "======================================"
log_success "   API 部署成功！"
log_success "======================================"
echo ""
log_info "📍 服務 URL: ${SERVICE_URL}"
echo ""
log_info "🧪 手動測試:"
log_info "   curl ${SERVICE_URL}/health"
log_info "   curl ${SERVICE_URL}/api/me  (需要 auth token)"
echo ""
log_info "💰 計費資訊:"
log_info "   - 最小實例數: 0 (完全按需付費)"
log_info "   - 最大實例數: 10"
log_info "   - 記憶體: 512Mi"
log_info "   - CPU: 1"
log_info "   - 閒置時自動縮減至 0，無請求時不收費"
log_info "   - Embedding: Gemini API (零冷啟動)"
log_info "   - ⚠️ Cold start 約 2-4 秒 (Cloud SQL Unix socket)"
echo ""
log_info "📝 下一步:"
log_info "   1. 更新 web/.env.production 中的 API URL:"
log_info "      NEXT_PUBLIC_API_URL=${SERVICE_URL}"
log_info "   2. 部署 Web Frontend:"
log_info "      ./scripts/deploy-web.sh"
echo ""
