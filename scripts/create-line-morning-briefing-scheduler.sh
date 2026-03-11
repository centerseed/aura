#!/bin/bash
# ==============================================================================
# create-line-morning-briefing-scheduler.sh
# 建立或更新 LINE 晨報推播 Cloud Scheduler job
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_DIR="$PROJECT_ROOT/api"
ENV_FILE="$API_DIR/.env"

PROJECT_ID="zentropy-4f7a5"
REGION="asia-east1"
TIME_ZONE="Asia/Taipei"
SCHEDULE="0 5-11 * * *"
ROUTE_PATH="/api/line/cron/morning-briefing"

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

usage() {
  cat <<EOF
使用方式:
  $0 [production|staging] [service-url]

範例:
  $0 production
  $0 staging
  $0 production https://zentropy-api-xxxx.a.run.app

說明:
  - 只會操作 GCP project: ${PROJECT_ID}
  - schedule 固定為台灣時間每天 05:00-11:00 每小時
  - route 固定為 ${ROUTE_PATH}
EOF
}

get_env_value() {
  local key=$1

  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}"
    return 0
  fi

  if [ -f "$ENV_FILE" ]; then
    grep "^${key}=" "$ENV_FILE" | cut -d '=' -f 2- | sed "s/^[\"']//;s/[\"']$//" | head -n 1
    return 0
  fi

  return 0
}

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

ENVIRONMENT="${1:-production}"
SERVICE_URL_ARG="${2:-}"

case "$ENVIRONMENT" in
  production|prod)
    SERVICE_NAME="zentropy-api"
    JOB_NAME="zentropy-line-morning-briefing"
    ;;
  staging)
    SERVICE_NAME="zentropy-api-staging"
    JOB_NAME="zentropy-line-morning-briefing-staging"
    ;;
  *)
    log_error "未知環境: $ENVIRONMENT"
    usage
    exit 1
    ;;
esac

if ! command -v gcloud &> /dev/null; then
  log_error "Google Cloud SDK 未安裝"
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' | head -n 1)"
if [ -z "$ACTIVE_ACCOUNT" ]; then
  log_error "尚未登入 gcloud，請先執行 gcloud auth login"
  exit 1
fi

log_info "使用 GCP 帳號: $ACTIVE_ACCOUNT"
log_info "設定 GCP 專案: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null

CRON_SECRET_VALUE="$(get_env_value CRON_SECRET)"
if [ -z "$CRON_SECRET_VALUE" ]; then
  log_error "找不到 CRON_SECRET。請先設定環境變數，或在 api/.env 提供。"
  exit 1
fi

if [ -n "$SERVICE_URL_ARG" ]; then
  SERVICE_URL="$SERVICE_URL_ARG"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format='value(status.url)')"
fi

if [ -z "$SERVICE_URL" ]; then
  log_error "無法取得 Cloud Run service URL: $SERVICE_NAME"
  exit 1
fi

TARGET_URL="${SERVICE_URL}${ROUTE_PATH}"

log_info "環境: $ENVIRONMENT"
log_info "Cloud Run service: $SERVICE_NAME"
log_info "Scheduler job: $JOB_NAME"
log_info "Target URL: $TARGET_URL"
log_info "Schedule: $SCHEDULE ($TIME_ZONE)"

COMMON_ARGS=(
  "$JOB_NAME"
  "--location=$REGION"
  "--schedule=$SCHEDULE"
  "--time-zone=$TIME_ZONE"
  "--uri=$TARGET_URL"
  "--http-method=POST"
  "--description=Push LINE morning briefing between 05:00 and 11:00 Asia/Taipei"
  "--message-body={}"
  "--max-retry-attempts=0"
)

if gcloud scheduler jobs describe "$JOB_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  log_warning "Scheduler job 已存在，改為更新設定"
  gcloud scheduler jobs update http "${COMMON_ARGS[@]}" \
    --clear-auth-token \
    --clear-headers \
    --update-headers="Authorization=Bearer ${CRON_SECRET_VALUE},Content-Type=application/json"
  log_success "Cloud Scheduler job 已更新"
else
  log_info "建立新的 Cloud Scheduler job"
  gcloud scheduler jobs create http "${COMMON_ARGS[@]}" \
    "--headers=Authorization=Bearer ${CRON_SECRET_VALUE},Content-Type=application/json"
  log_success "Cloud Scheduler job 已建立"
fi

echo ""
log_info "立即手動觸發測試："
echo "gcloud scheduler jobs run $JOB_NAME --location=$REGION --project=$PROJECT_ID"
