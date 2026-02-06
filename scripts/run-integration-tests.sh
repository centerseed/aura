#!/bin/bash
# ==============================================================================
# run-integration-tests.sh - 執行 Flutter 整合測試（自動啟動 API）
# ==============================================================================
#
# 用途: 檢查本地 API server 是否運行，沒有則自動啟動，然後執行整合測試
#
# 使用方式:
#   ./scripts/run-integration-tests.sh                    # 跑所有整合測試
#   ./scripts/run-integration-tests.sh api_connection     # 跑指定測試
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
API_PORT=3002
API_STARTED_BY_US=false
API_PID=""

# 顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

# ==============================================================================
# 清理：測試結束後關閉我們啟動的 API server
# ==============================================================================
cleanup() {
    if [ "$API_STARTED_BY_US" = true ] && [ -n "$API_PID" ]; then
        log_info "關閉由本腳本啟動的 API server (PID: $API_PID)..."
        kill "$API_PID" 2>/dev/null || true
        wait "$API_PID" 2>/dev/null || true
        log_success "API server 已關閉"
    fi
}
trap cleanup EXIT

# ==============================================================================
# 檢查 API server 是否在運行
# ==============================================================================
check_api() {
    curl -s -o /dev/null -w "%{http_code}" "http://localhost:$API_PORT/api" --max-time 3 2>/dev/null
}

# ==============================================================================
# 等待 API server 就緒
# ==============================================================================
wait_for_api() {
    local max_wait=60
    local waited=0

    log_info "等待 API server 就緒..."
    while [ $waited -lt $max_wait ]; do
        local status
        status=$(check_api) || true
        if [ -n "$status" ] && [ "$status" != "000" ]; then
            log_success "API server 就緒 (HTTP $status, 等待 ${waited}s)"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        printf "."
    done
    echo ""
    log_error "API server 在 ${max_wait}s 內未就緒"
    return 1
}

# ==============================================================================
# 主程式
# ==============================================================================

# 1. 檢查 API server
log_info "檢查 API server (localhost:$API_PORT)..."
API_STATUS=$(check_api) || true

if [ -n "$API_STATUS" ] && [ "$API_STATUS" != "000" ]; then
    log_success "API server 已在運行 (HTTP $API_STATUS)"
else
    log_warning "API server 未運行，正在啟動..."

    # 啟動 API server（背景執行）
    cd "$PROJECT_ROOT/api"

    if [ ! -f ".env.local" ]; then
        log_error "找不到 api/.env.local，無法啟動 API server"
        exit 1
    fi

    # 確保依賴和 Prisma client 存在
    if [ ! -d "node_modules" ]; then
        log_info "安裝依賴..."
        npm install
    fi
    npm run prisma:generate 2>/dev/null

    PORT=$API_PORT npm run dev > /tmp/naruvia-api-test.log 2>&1 &
    API_PID=$!
    API_STARTED_BY_US=true

    log_info "API server 啟動中 (PID: $API_PID, log: /tmp/naruvia-api-test.log)"

    if ! wait_for_api; then
        log_error "API server 啟動失敗，查看 log: /tmp/naruvia-api-test.log"
        exit 1
    fi
fi

# 2. 執行 Flutter 整合測試
cd "$PROJECT_ROOT/app"

TEST_TARGET=${1:-}

if [ -n "$TEST_TARGET" ]; then
    log_info "執行整合測試: $TEST_TARGET"
    flutter test "test/integration/${TEST_TARGET}_test.dart"
else
    log_info "執行所有整合測試..."
    flutter test test/integration/
fi

log_success "整合測試完成"
