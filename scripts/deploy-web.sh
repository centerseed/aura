#!/bin/bash
# ==============================================================================
# deploy-web.sh - 部署 Web Frontend 到 Firebase Hosting
# ==============================================================================
#
# 用途: 將前端 Web (web/) 部署到 Firebase Hosting (靜態托管)
#
# 使用方式:
#   ./scripts/deploy-web.sh              # 部署到 production
#   ./scripts/deploy-web.sh staging      # 部署到 staging
#
# 部署配置:
#   - Platform: Firebase Hosting (靜態 CDN)
#   - Output: Static HTML/CSS/JS (Next.js export mode)
#   - API: 連接到 Cloud Run 上的 API
#
# 注意事項:
#   - 確保已部署 API 到 Cloud Run
#   - 確保 .env.production 中的 NEXT_PUBLIC_API_URL 設定正確
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_DIR="$PROJECT_ROOT/web"

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
log_info "   Naruvia Web - Firebase Hosting"
log_info "======================================"
echo ""

# 解析環境參數
ENVIRONMENT="${1:-production}"

# Firebase 設定
FIREBASE_PROJECT="zentropy-4f7a5"

case "$ENVIRONMENT" in
    staging)
        HOSTING_TARGET="staging"
        log_info "部署環境: Staging"
        ;;
    production|prod)
        HOSTING_TARGET="production"
        log_info "部署環境: Production"
        ;;
    *)
        log_error "未知環境: $ENVIRONMENT"
        echo ""
        echo "使用方式: $0 [staging|production]"
        exit 1
        ;;
esac

# 檢查 Firebase CLI
if ! command -v firebase &> /dev/null; then
    log_error "Firebase CLI 未安裝"
    log_info "請執行: npm install -g firebase-tools"
    exit 1
fi

# 切換到 web 目錄
cd "$WEB_DIR"

# 1. 檢查環境變數
if [ ! -f ".env.production" ]; then
    log_error "找不到 web/.env.production"
    log_info "請先建立環境變數檔案，包含 NEXT_PUBLIC_API_URL"
    exit 1
fi

# 檢查 API URL 是否設定
if ! grep -q "NEXT_PUBLIC_API_URL" .env.production; then
    log_error ".env.production 中缺少 NEXT_PUBLIC_API_URL"
    log_info "請設定: NEXT_PUBLIC_API_URL=https://your-api-service.run.app"
    exit 1
fi

API_URL=$(grep "NEXT_PUBLIC_API_URL" .env.production | cut -d '=' -f2)
log_info "API URL: $API_URL"

# 2. 安裝依賴
log_info "檢查依賴..."
if [ ! -d "node_modules" ]; then
    log_info "安裝依賴..."
    npm ci
else
    log_success "依賴已安裝"
fi

# 3. 生成 Prisma Client
log_info "生成 Prisma Client..."
npm run db:generate

# 4. 執行 TypeScript 檢查
log_info "執行 TypeScript 檢查..."
npx tsc --noEmit || log_warning "TypeScript 檢查發現問題，繼續部署..."

# 5. 執行測試 (可選，如果測試失敗則中止)
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "執行測試..."
    npm run test || {
        log_error "測試失敗，中止部署"
        exit 1
    }
    log_success "測試通過"
fi

# 6. 建置 (靜態導出模式)
log_info "執行生產建置 (靜態導出模式)..."
log_warning "確保 next.config.ts 設定為: output: 'export'"

# 設定環境變數並建置
NODE_ENV=production npm run build

# 檢查 out 目錄是否存在
if [ ! -d "out" ]; then
    log_error "建置失敗: 找不到 out/ 目錄"
    log_info "請檢查 next.config.ts 是否設定 output: 'export'"
    exit 1
fi

log_success "建置完成"

# 7. 檢查 firebase.json
if [ ! -f "firebase.json" ]; then
    log_error "找不到 firebase.json"
    exit 1
fi

# 8. 部署到 Firebase Hosting
log_info "部署到 Firebase Hosting..."

if [ "$ENVIRONMENT" = "staging" ]; then
    # Staging 環境
    firebase deploy \
        --only hosting:staging \
        --project "$FIREBASE_PROJECT"
else
    # Production 環境
    firebase deploy \
        --only hosting \
        --project "$FIREBASE_PROJECT"
fi

echo ""
log_success "======================================"
log_success "   Web 部署成功！"
log_success "======================================"
echo ""
log_info "📍 部署資訊:"
if [ "$ENVIRONMENT" = "staging" ]; then
    log_info "   Staging URL: https://staging--zentropy-4f7a5.web.app"
else
    log_info "   Production URL: https://zentropy-4f7a5.web.app"
    log_info "   Custom Domain: (如有設定自訂網域)"
fi
echo ""
log_info "🔗 連接的 API:"
log_info "   ${API_URL}"
echo ""
log_info "🔍 查看部署狀態:"
log_info "   firebase hosting:channel:list --project $FIREBASE_PROJECT"
echo ""
log_info "💡 提示:"
log_info "   - 部署為靜態 CDN，全球加速"
log_info "   - 所有 API 請求會轉發到 Cloud Run"
log_info "   - 無伺服器運算，只有流量費用"
echo ""
