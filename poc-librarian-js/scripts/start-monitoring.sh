#!/bin/bash

# 顏色定義
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}🔍 Librarian 蒸餾規則監控系統${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# 確保在正確的目錄
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# 檢查 .env 檔案
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  找不到 .env 檔案，請確認 DATABASE_URL 已設定${NC}"
  echo ""
  exit 1
fi

# 檢查 monitoring 目錄
if [ ! -d "monitoring" ]; then
  echo -e "${YELLOW}⚠️  找不到 monitoring 目錄${NC}"
  echo ""
  exit 1
fi

echo -e "${GREEN}✓${NC} 啟動監控服務..."
echo ""

# 啟動監控服務
node monitoring/server.js
