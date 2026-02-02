#!/bin/bash

# 前端部署腳本 - Next.js to Firebase Hosting
# 使用方式: ./scripts/deploy-web-firebase.sh [staging|production]

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

case "$ENVIRONMENT" in
    staging)
        FIREBASE_PROJECT="zentropy-4f7a5"
        HOSTING_TARGET="staging"
        log_info "部署環境: Staging"
        ;;
    production|prod)
        FIREBASE_PROJECT="zentropy-4f7a5"
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

# 檢查環境變數檔案
if [ ! -f ".env.local" ] && [ ! -f ".env.production" ]; then
    log_error "找不到環境變數檔案 (.env.local 或 .env.production)"
    exit 1
fi

# 1. 安裝依賴
log_info "檢查依賴..."
if [ ! -d "node_modules" ]; then
    log_info "安裝依賴..."
    npm ci
else
    log_success "依賴已安裝"
fi

# 2. 生成 Prisma Client
log_info "生成 Prisma Client..."
npm run db:generate

# 3. 執行 TypeScript 檢查
log_info "執行 TypeScript 檢查..."
npx tsc --noEmit || log_warning "TypeScript 檢查發現問題，繼續部署..."

# 4. 執行測試 (可選，如果測試失敗則中止)
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "執行測試..."
    npm run test || {
        log_error "測試失敗，中止部署"
        exit 1
    }
    log_success "測試通過"
fi

# 5. 建置
log_info "執行生產建置..."
npm run build
log_success "建置完成"

# 6. 部署到 Firebase Hosting
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
log_success "部署完成！"
echo ""
log_info "📍 部署資訊:"
if [ "$ENVIRONMENT" = "staging" ]; then
    log_info "   Staging URL: https://staging.zentropy.app (設定 hosting target)"
else
    log_info "   Production URL: https://zentropy.app"
fi
echo ""
log_info "🔍 查看部署狀態:"
log_info "   firebase hosting:channel:list --project $FIREBASE_PROJECT"
echo ""
