#!/bin/bash
# ============================================================================
# local-docker-build.sh - 本地 Docker 建置（僅供開發測試）
# ============================================================================
#
# 使用方式：
#   ./scripts/local-docker-build.sh
#
# 說明：
#   - 僅在本地建置 Docker 映像（Mac 架構）
#   - 不推送至 GCR
#   - 用於本地測試 Docker 建置流程
# ============================================================================

set -e  # 遇到錯誤立即退出

# 顏色輸出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 配置變數
API_DIR="api"
IMAGE_NAME="zentropy-api-local"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  本地 Docker 建置（開發用）${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 1. 檢查是否在專案根目錄
if [ ! -d "$API_DIR" ]; then
  echo -e "${YELLOW}錯誤：找不到 api/ 目錄，請在專案根目錄執行此腳本${NC}"
  exit 1
fi

# 2. 切換到 api 目錄
cd "$API_DIR"
echo -e "${GREEN}[1/3] 準備建置...${NC}"

# 3. 建立 .dockerignore (如果不存在)
if [ ! -f ".dockerignore" ]; then
  echo -e "${YELLOW}創建 .dockerignore...${NC}"
  cat > .dockerignore << 'DOCKERIGNORE'
node_modules
.next
.env.local
.git
.gitignore
README.md
npm-debug.log
tests
DOCKERIGNORE
fi

# 4. 建置 Next.js
echo -e "${GREEN}[2/3] 建置 Next.js...${NC}"
npm run build

# 5. 建立 Docker 映像（本地架構）
echo -e "${GREEN}[3/3] 建立 Docker 映像（本地 Mac 架構）...${NC}"
docker build -t "$IMAGE_NAME:latest" .

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  建置成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}映像名稱:${NC} $IMAGE_NAME:latest"
echo ""
echo -e "${YELLOW}測試執行:${NC}"
echo -e "  docker run -p 3001:3001 $IMAGE_NAME:latest"
echo ""
echo -e "${YELLOW}注意:${NC} 此映像僅供本地測試，不適合部署至 Cloud Run"
echo -e "       部署請使用: ./scripts/deploy-backend.sh"
echo ""
