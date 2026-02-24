#!/bin/bash
# ==============================================================================
# dev-web.sh - Web Frontend 本地開發伺服器
# ==============================================================================
#
# 用途: 啟動 Next.js Web 前端開發伺服器
#
# 使用方式:
#   ./scripts/dev-web.sh           # 連接本地 API (localhost:3002)
#   ./scripts/dev-web.sh local     # 連接本地 API (localhost:3002)
#   ./scripts/dev-web.sh remote    # 連接 Cloud Run API
#
# 環境配置:
#   - Web: http://localhost:3001
#   - API (local): http://localhost:3002
#   - API (remote): https://api.zentropy.cc
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 端口配置
WEB_PORT=3001

# API URL 配置
LOCAL_API_URL="http://localhost:3002"
REMOTE_API_URL="https://api.zentropy.cc"

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

# ==============================================================================
# 檢查並釋放端口
# ==============================================================================
kill_port() {
    local port=$1
    local service_name=$2

    local pid=$(lsof -ti :$port)

    if [ -n "$pid" ]; then
        log_warning "$service_name 端口 $port 被佔用 (PID: $pid)"

        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        log_info "正在終止進程: $process_name (PID: $pid)"

        kill $pid 2>/dev/null || true
        sleep 1

        if kill -0 $pid 2>/dev/null; then
            log_warning "進程未響應,強制終止..."
            kill -9 $pid 2>/dev/null || true
            sleep 1
        fi

        if lsof -ti :$port > /dev/null 2>&1; then
            log_error "無法釋放端口 $port"
            return 1
        fi

        log_success "端口 $port 已釋放"
    fi

    return 0
}

# ==============================================================================
# 啟動 Web (Frontend)
# ==============================================================================
start_web() {
    local mode=${1:-local}
    local api_url

    if [ "$mode" = "remote" ]; then
        api_url="$REMOTE_API_URL"
    else
        api_url="$LOCAL_API_URL"
    fi

    log_info "======================================"
    if [ "$mode" = "remote" ]; then
        log_info "   Naruvia Web Frontend (Remote API)"
    else
        log_info "   Naruvia Web Frontend (Local API)"
    fi
    log_info "======================================"
    echo ""
    log_info "Web:  http://localhost:$WEB_PORT"
    log_info "API:  $api_url"
    echo ""

    # 釋放端口
    kill_port $WEB_PORT "Web"

    cd "$PROJECT_ROOT/web"

    # 檢查環境變數
    if [ ! -f ".env.local" ]; then
        log_error "找不到 web/.env.local，請先設定環境變數"
        exit 1
    fi

    # 檢查依賴
    if [ ! -d "node_modules" ]; then
        log_info "安裝 Web 依賴..."
        npm install
    fi

    # 生成 Prisma Client
    log_info "生成 Prisma Client..."
    npm run db:generate

    log_success "Web 啟動中: http://localhost:$WEB_PORT"

    # 使用環境變數覆蓋 API URL
    NEXT_PUBLIC_API_URL="$api_url" PORT=$WEB_PORT npm run dev
}

# ==============================================================================
# 主程式
# ==============================================================================
MODE=${1:-local}

if [ "$MODE" != "local" ] && [ "$MODE" != "remote" ]; then
    log_error "無效的模式: $MODE"
    echo ""
    echo "使用方式:"
    echo "  ./scripts/dev-web.sh           # 連接本地 API"
    echo "  ./scripts/dev-web.sh local     # 連接本地 API"
    echo "  ./scripts/dev-web.sh remote    # 連接 Cloud Run API"
    exit 1
fi

start_web "$MODE"
