#!/bin/bash
# ==============================================================================
# dev-local.sh - 本地開發環境啟動腳本
# ==============================================================================
#
# 用途: 同時啟動前端 (web) 和後端 (api) 的本地開發伺服器
#
# 使用方式:
#   ./scripts/dev-local.sh          # 同時啟動 web + api
#   ./scripts/dev-local.sh web      # 只啟動 web
#   ./scripts/dev-local.sh api      # 只啟動 api
#
# 環境配置:
#   - Web: http://localhost:3001 -> API: http://localhost:3002
#   - Database: Remote Supabase (PostgreSQL)
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 端口配置
WEB_PORT=3001
API_PORT=3002

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

    # 檢查端口是否被佔用
    local pid=$(lsof -ti :$port)

    if [ -n "$pid" ]; then
        log_warning "$service_name 端口 $port 被佔用 (PID: $pid)"

        # 嘗試取得進程名稱
        local process_name=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
        log_info "正在終止進程: $process_name (PID: $pid)"

        # 先嘗試正常終止
        kill $pid 2>/dev/null || true
        sleep 1

        # 如果還在運行,強制終止
        if kill -0 $pid 2>/dev/null; then
            log_warning "進程未響應,強制終止..."
            kill -9 $pid 2>/dev/null || true
            sleep 1
        fi

        # 再次檢查端口是否釋放
        if lsof -ti :$port > /dev/null 2>&1; then
            log_error "無法釋放端口 $port"
            return 1
        fi

        log_success "端口 $port 已釋放"
    fi

    return 0
}

# ==============================================================================
# 啟動 API (Backend)
# ==============================================================================
start_api() {
    log_info "啟動 API Backend (Port $API_PORT)..."

    # 釋放端口
    kill_port $API_PORT "API"

    cd "$PROJECT_ROOT/api"

    # 檢查環境變數
    if [ ! -f ".env.local" ]; then
        log_error "找不到 api/.env.local，請先設定環境變數"
        exit 1
    fi

    # 檢查依賴
    if [ ! -d "node_modules" ]; then
        log_info "安裝 API 依賴..."
        npm install
    fi

    # 生成 Prisma Client
    log_info "生成 Prisma Client..."
    npm run prisma:generate

    log_success "API 啟動中: http://localhost:$API_PORT"
    PORT=$API_PORT npm run dev
}

# ==============================================================================
# 啟動 Web (Frontend)
# ==============================================================================
start_web() {
    log_info "啟動 Web Frontend (Port $WEB_PORT)..."

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
    PORT=$WEB_PORT npm run dev
}

# ==============================================================================
# 同時啟動 Web + API
# ==============================================================================
start_all() {
    log_info "======================================"
    log_info "   Naruvia 本地開發環境"
    log_info "======================================"
    echo ""
    log_info "Web:  http://localhost:$WEB_PORT"
    log_info "API:  http://localhost:$API_PORT"
    log_info "DB:   Remote Supabase"
    echo ""

    # 釋放端口
    kill_port $WEB_PORT "Web"
    kill_port $API_PORT "API"
    echo ""

    # 使用 trap 捕捉 Ctrl+C
    trap 'log_warning "停止所有服務..."; kill 0; exit 0' INT TERM

    # 在背景啟動 API
    (
        cd "$PROJECT_ROOT/api"
        if [ ! -f ".env.local" ]; then
            log_error "找不到 api/.env.local"
            exit 1
        fi
        if [ ! -d "node_modules" ]; then
            log_info "[API] 安裝依賴..."
            npm install
        fi
        log_info "[API] 生成 Prisma Client..."
        npm run prisma:generate > /dev/null 2>&1
        log_success "[API] 啟動: http://localhost:$API_PORT"
        PORT=$API_PORT npm run dev 2>&1 | sed 's/^/[API] /'
    ) &

    # 等待 API 啟動
    sleep 3

    # 在背景啟動 Web
    (
        cd "$PROJECT_ROOT/web"
        if [ ! -f ".env.local" ]; then
            log_error "找不到 web/.env.local"
            exit 1
        fi
        if [ ! -d "node_modules" ]; then
            log_info "[Web] 安裝依賴..."
            npm install
        fi
        log_info "[Web] 生成 Prisma Client..."
        npm run db:generate > /dev/null 2>&1
        log_success "[Web] 啟動: http://localhost:$WEB_PORT"
        PORT=$WEB_PORT npm run dev 2>&1 | sed 's/^/[Web] /'
    ) &

    # 等待所有背景程序
    wait
}

# ==============================================================================
# 主程式
# ==============================================================================

MODE="${1:-all}"

case "$MODE" in
    api)
        start_api
        ;;
    web)
        start_web
        ;;
    all)
        start_all
        ;;
    *)
        log_error "未知模式: $MODE"
        echo ""
        echo "使用方式:"
        echo "  $0          # 同時啟動 web + api"
        echo "  $0 web      # 只啟動 web"
        echo "  $0 api      # 只啟動 api"
        exit 1
        ;;
esac
