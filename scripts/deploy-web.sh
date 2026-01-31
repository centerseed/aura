#!/bin/bash
# ============================================================================
# deploy-web.sh - 部署 Frontend 到 Firebase Hosting
# ============================================================================
#
# 使用方式：
#   ./scripts/deploy-web.sh
#
# 功能：
#   - 建置 Next.js 前端專案
#   - 部署至 Firebase Hosting
# ============================================================================

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置變數
WEB_DIR="web"
FIREBASE_PROJECT="zentropy-app"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  部署 Zentropy Frontend${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 檢查是否在專案根目錄
if [ ! -d "$WEB_DIR" ]; then
  echo -e "${RED}錯誤：找不到 web/ 目錄，請在專案根目錄執行此腳本${NC}"
  exit 1
fi

# 2. 檢查 Firebase CLI
if ! command -v firebase &> /dev/null; then
  echo -e "${RED}錯誤：找不到 Firebase CLI，請執行: npm install -g firebase-tools${NC}"
  exit 1
fi

# 3. 切換到 web 目錄
cd "$WEB_DIR"
echo -e "${GREEN}[1/4] 準備前端專案...${NC}"

# 4. 安裝依賴 (如果需要)
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}安裝依賴...${NC}"
  npm install
fi

# 5. 建置 Next.js (靜態導出模式)
echo -e "${GREEN}[2/4] 建置 Next.js 前端...${NC}"
npm run build

# 6. 檢查 firebase.json
if [ ! -f "firebase.json" ]; then
  echo -e "${YELLOW}創建 firebase.json...${NC}"
  cat > firebase.json << 'FIREBASEJSON'
{
  "hosting": {
    "public": "out",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp|ico)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
FIREBASEJSON
fi

# 7. 登入 Firebase (如果需要)
echo -e "${GREEN}[3/4] 驗證 Firebase 登入...${NC}"
firebase login --reauth

# 8. 部署至 Firebase Hosting
echo -e "${GREEN}[4/4] 部署至 Firebase Hosting...${NC}"
firebase deploy --only hosting --project "$FIREBASE_PROJECT"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  部署成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}前端 URL:${NC} https://${FIREBASE_PROJECT}.web.app"
echo ""
echo -e "${YELLOW}注意：${NC}"
echo -e "  - 請確保 Next.js 配置為靜態導出模式 (output: 'export')"
echo -e "  - 前端會呼叫已部署的 API (需在環境變數設定 API_URL)"
echo ""
