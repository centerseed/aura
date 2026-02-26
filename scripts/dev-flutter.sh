#!/bin/bash
# ==============================================================================
# dev-flutter.sh - 本地 Flutter 開發環境一鍵啟動
# ==============================================================================
#
# 用途: 同時啟動 API Backend + Flutter Chrome，供 Marionette MCP 測試使用
#
# 使用方式:
#   ./scripts/dev-flutter.sh          # Chrome（預設）
#   ./scripts/dev-flutter.sh ios      # iOS Simulator
#
# Flutter VM Service:
#   ws://127.0.0.1:56789/ws  （固定 port，無 auth token）
#
# API Backend:
#   http://localhost:3002/api
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="$PROJECT_ROOT/app"

# 顏色輸出
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
# 解析參數
# ==============================================================================
DEVICE="${1:-chrome}"

case "$DEVICE" in
  chrome|web)
    FLUTTER_DEVICE="chrome"
    DEVICE_LABEL="Chrome"
    ;;
  ios|simulator)
    FLUTTER_DEVICE="$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1)"
    if [ -z "$FLUTTER_DEVICE" ]; then
      log_warning "沒有已啟動的 iOS Simulator，嘗試啟動 iPhone 16..."
      xcrun simctl boot "iPhone 16" 2>/dev/null || true
      open -a Simulator
      sleep 3
      FLUTTER_DEVICE="$(xcrun simctl list devices booted | grep -o '[A-F0-9-]\{36\}' | head -1)"
    fi
    DEVICE_LABEL="iOS Simulator"
    ;;
  *)
    log_error "未知裝置: $DEVICE"
    echo "使用方式: $0 [chrome|ios]"
    exit 1
    ;;
esac

# ==============================================================================
# 清理函數：腳本退出時一起關閉 API
# ==============================================================================
API_PID=""

cleanup() {
  echo ""
  log_info "關閉中..."
  if [ -n "$API_PID" ] && kill -0 "$API_PID" 2>/dev/null; then
    log_info "停止 API Backend (PID: $API_PID)..."
    kill "$API_PID" 2>/dev/null || true
    # 也確保 port 3002 被釋放
    lsof -ti :3002 | xargs kill 2>/dev/null || true
  fi
  log_success "已清理"
}

trap cleanup SIGINT SIGTERM EXIT

# ==============================================================================
# 啟動 API Backend（背景執行）
# ==============================================================================
echo ""
log_info "======================================"
log_info "  Flutter 本地開發環境"
log_info "  裝置: $DEVICE_LABEL"
log_info "======================================"
echo ""

log_info "啟動 API Backend (背景)..."
"$SCRIPT_DIR/dev-api.sh" &
API_PID=$!

# ==============================================================================
# 等待 API 就緒
# ==============================================================================
log_info "等待 API 就緒 (http://localhost:3002/health)..."

MAX_WAIT=60
WAITED=0
until curl -sf http://localhost:3002/health > /dev/null 2>&1; do
  if [ $WAITED -ge $MAX_WAIT ]; then
    log_error "API 啟動超時（${MAX_WAIT}s），請檢查 dev-api.sh 是否正常"
    exit 1
  fi
  sleep 2
  WAITED=$((WAITED + 2))
  echo -n "."
done
echo ""
log_success "API 已就緒 (http://localhost:3002/api)"

# ==============================================================================
# 啟動 Flutter
# ==============================================================================
echo ""
log_info "啟動 Flutter ($DEVICE_LABEL)..."
log_info "VM Service: ws://127.0.0.1:56789/ws"
echo ""
log_success "Marionette MCP 連線指令："
log_success "  Connect to ws://127.0.0.1:56789/ws"
echo ""

cd "$APP_DIR"
flutter run \
  --debug \
  --device-id "$FLUTTER_DEVICE" \
  --host-vmservice-port=56789 \
  --disable-service-auth-codes
