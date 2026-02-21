#!/bin/bash
# deploy-ios.sh - Flutter iOS 上架腳本（使用 fastlane）
set -e

# ── 顏色輸出 ──────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${GREEN}[iOS]${NC} $1"; }
warn()    { echo -e "${YELLOW}[iOS]${NC} $1"; }
error()   { echo -e "${RED}[iOS] 錯誤：$1${NC}"; exit 1; }

# ── 參數解析 ──────────────────────────────────
LANE="${1:-beta}"   # 預設上傳到 TestFlight

if [[ "$LANE" != "beta" && "$LANE" != "release" ]]; then
  echo "用法: $0 [beta|release]"
  echo "  beta    - 上傳到 TestFlight（預設）"
  echo "  release - 提交 App Store 審核"
  exit 1
fi

# ── 載入環境變數 ──────────────────────────────
ENV_FILE="$(dirname "$0")/../app/.env.ios"
if [[ -f "$ENV_FILE" ]]; then
  source "$ENV_FILE"
  info "已載入 $ENV_FILE"
else
  error "找不到 $ENV_FILE，請先複製 app/.env.ios.example 並填寫"
fi

# ── 必要環境變數檢查 ──────────────────────────
check_env() {
  if [[ -z "${!1}" ]]; then
    error "環境變數 $1 未設定，請確認 app/.env.ios"
  fi
}
check_env "APPLE_ID"
check_env "APPLE_TEAM_ID"
check_env "ITC_TEAM_ID"
check_env "ASC_API_KEY_PATH"

# ── 工具檢查 ──────────────────────────────────
command -v flutter >/dev/null || error "找不到 flutter 命令"
command -v fastlane >/dev/null || error "找不到 fastlane，請先安裝：brew install fastlane"

# ── 顯示版本資訊 ──────────────────────────────
VERSION=$(grep "^version:" app/pubspec.yaml | awk '{print $2}' | cut -d'+' -f1)
info "App 版本：$VERSION"
info "執行 lane：$LANE"
echo ""

# ── 確認（release 時額外警告）────────────────
if [[ "$LANE" == "release" ]]; then
  warn "⚠️  你正在提交 App Store 正式審核，確認要繼續嗎？"
  read -p "輸入 yes 確認：" CONFIRM
  [[ "$CONFIRM" != "yes" ]] && { warn "已取消"; exit 0; }
fi

# ── 安裝 Pods（如果需要）────────────────────
info "更新 CocoaPods..."
cd app/ios
pod install --repo-update 2>/dev/null || warn "pod install 有警告，繼續..."
cd ../..

# ── 執行 fastlane ─────────────────────────────
info "開始執行 fastlane $LANE..."
cd app/ios
fastlane "$LANE"
cd ../..

info "🎉 完成！"
if [[ "$LANE" == "beta" ]]; then
  info "請到 App Store Connect → TestFlight 確認版本狀態"
else
  info "請到 App Store Connect → App 審核 確認提交狀態"
fi
