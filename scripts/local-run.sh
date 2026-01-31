#!/bin/bash
# ============================================================================
# local-run.sh - 在本地同時運行前後端進行測試
# ============================================================================
#
# 使用方式：
#   ./scripts/local-run.sh
#
# 功能：
#   - 在背景啟動 API Server (port 3001)
#   - 在前景啟動 Web Server (port 3000)
#   - Ctrl+C 時自動清理所有進程
# ============================================================================

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 記錄背景進程 PID
API_PID=""
WEB_PID=""

# 清理函數
cleanup() {
  echo ""
  echo -e "${YELLOW}正在停止伺服器...${NC}"
  
  if [ ! -z "$API_PID" ]; then
    echo -e "${YELLOW}停止 API Server (PID: $API_PID)${NC}"
    kill $API_PID 2>/dev/null || true
  fi
  
  if [ ! -z "$WEB_PID" ]; then
    echo -e "${YELLOW}停止 Web Server (PID: $WEB_PID)${NC}"
    kill $WEB_PID 2>/dev/null || true
  fi
  
  echo -e "${GREEN}所有伺服器已停止${NC}"
  exit 0
}

# 註冊 SIGINT (Ctrl+C) 處理
trap cleanup SIGINT SIGTERM

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  啟動 Zentropy 本地開發環境${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 檢查目錄
if [ ! -d "api" ] || [ ! -d "web" ]; then
  echo -e "${RED}錯誤：找不到 api/ 或 web/ 目錄，請在專案根目錄執行此腳本${NC}"
  exit 1
fi

# 2. 檢查 .env 檔案
if [ ! -f "api/.env" ]; then
  echo -e "${RED}錯誤：找不到 api/.env 檔案${NC}"
  echo -e "${YELLOW}提示：請從 api/.env.example 複製並設定環境變數${NC}"
  exit 1
fi

if [ ! -f "web/.env.local" ]; then
  echo -e "${YELLOW}警告：找不到 web/.env.local 檔案${NC}"
  echo -e "${YELLOW}提示：請從 web/.env.example 複製並設定環境變數${NC}"
fi

# 3. 安裝依賴（如果需要）
echo -e "${GREEN}[1/4] 檢查依賴...${NC}"

if [ ! -d "api/node_modules" ]; then
  echo -e "${YELLOW}安裝 API 依賴...${NC}"
  cd api && npm install && cd ..
fi

if [ ! -d "web/node_modules" ]; then
  echo -e "${YELLOW}安裝 Web 依賴...${NC}"
  cd web && npm install && cd ..
fi

# 4. 生成 Prisma Client
echo -e "${GREEN}[2/4] 生成 Prisma Client...${NC}"
cd api && npx prisma generate && cd ..

# 5. 啟動 API Server (背景)
echo -e "${GREEN}[3/4] 啟動 API Server (port 3001)...${NC}"
cd api
npm run dev > ../logs/api.log 2>&1 &
API_PID=$!
cd ..

echo -e "${BLUE}API Server PID: $API_PID${NC}"
sleep 3  # 等待 API 啟動

# 檢查 API 是否成功啟動
if ! ps -p $API_PID > /dev/null; then
  echo -e "${RED}錯誤：API Server 啟動失敗${NC}"
  echo -e "${YELLOW}查看日誌: tail logs/api.log${NC}"
  exit 1
fi

echo -e "${GREEN}✓ API Server 運行中${NC}"

# 6. 啟動 Web Server (前景)
echo -e "${GREEN}[4/4] 啟動 Web Server (port 3000)...${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  開發環境已就緒${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}API:${NC}  http://localhost:3001/api"
echo -e "${GREEN}Web:${NC}  http://localhost:3000"
echo ""
echo -e "${YELLOW}提示：${NC}"
echo -e "  - 按 Ctrl+C 停止所有伺服器"
echo -e "  - API 日誌: tail -f logs/api.log"
echo -e "  - Web 日誌會顯示在下方"
echo ""
echo -e "${BLUE}========================================${NC}"
echo ""

cd web
npm run dev
WEB_PID=$!

# 等待 Web Server
wait $WEB_PID
