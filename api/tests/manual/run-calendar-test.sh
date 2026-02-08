#!/bin/bash

# Calendar CRUD 測試執行腳本

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Google Calendar API CRUD 測試                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 檢查是否提供了 Firebase Token
# 支援從 .env.test.local 讀取
if [ -f .env.test.local ]; then
  export $(grep -v '^#' .env.test.local | xargs)
fi

if [ -z "$FIREBASE_TOKEN" ]; then
  echo "❌ 錯誤：請提供 FIREBASE_TOKEN"
  echo ""
  echo "獲取 token 的方式："
  echo "1. 在瀏覽器登入 https://zentropy.cc/test-calendar"
  echo "2. 點擊「📋 複製完整 Token」按鈕"
  echo ""
  echo "使用方式（擇一）："
  echo ""
  echo "方式 1 - 環境變數："
  echo "  export FIREBASE_TOKEN=\"你複製的token\""
  echo "  ./tests/manual/run-calendar-test.sh"
  echo ""
  echo "方式 2 - 創建 .env.test.local 檔案（推薦）："
  echo "  echo 'FIREBASE_TOKEN=\"你的token\"' > .env.test.local"
  echo "  ./tests/manual/run-calendar-test.sh"
  echo ""
  exit 1
fi

# 設置 API URL（預設為生產環境）
export API_BASE_URL="${API_BASE_URL:-https://zentropy.cc/api}"

echo "🔗 API URL: $API_BASE_URL"
echo "🔑 Token: ${FIREBASE_TOKEN:0:20}..."
echo ""

# 執行測試
npx tsx tests/manual/calendar-crud-test.ts
