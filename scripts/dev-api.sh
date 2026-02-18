#!/bin/bash
# ==============================================================================
# dev-api.sh - API Backend 本地開發伺服器
# ==============================================================================
#
# 用途: 啟動 API Backend 開發伺服器（Next.js + MCP endpoint）
#
# 使用方式:
#   ./scripts/dev-api.sh              # 開發模式 (server.ts = Next.js + /mcp)
#   ./scripts/dev-api.sh prod         # 生產模式 (next build && next start)
#   ./scripts/dev-api.sh standalone   # Standalone 模式 (node server.js)
#   ./scripts/dev-api.sh docker       # Docker 模式 (模擬 Cloud Run 環境)
#
# 環境配置:
#   - API: http://localhost:3002
#   - Web: http://localhost:3001 (需另外啟動 dev-web.sh)
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 端口配置
API_PORT=3002
DOCKER_IMAGE_NAME="zentropy-api-local"

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
# 停止並移除舊的 Docker 容器
# ==============================================================================
stop_docker_container() {
    local container_name=$1

    if docker ps -q -f name="$container_name" | grep -q .; then
        log_info "停止舊的 Docker 容器..."
        docker stop "$container_name" 2>/dev/null || true
    fi

    if docker ps -aq -f name="$container_name" | grep -q .; then
        log_info "移除舊的 Docker 容器..."
        docker rm "$container_name" 2>/dev/null || true
    fi
}

# ==============================================================================
# 啟動 API (Backend)
# ==============================================================================
start_api() {
    local mode=${1:-dev}

    log_info "======================================"
    if [ "$mode" = "prod" ]; then
        log_info "   Naruvia API Backend (生產模式)"
    elif [ "$mode" = "standalone" ]; then
        log_info "   Naruvia API Backend (Standalone 模式)"
    elif [ "$mode" = "docker" ]; then
        log_info "   Naruvia API Backend (Docker 模式)"
    else
        log_info "   Naruvia API Backend (開發模式)"
    fi
    log_info "======================================"
    echo ""
    log_info "API:  http://localhost:$API_PORT"
    log_info "Web:  http://localhost:3001 (需另外啟動)"
    echo ""

    cd "$PROJECT_ROOT/api"

    # 檢查環境變數
    if [ ! -f ".env.local" ]; then
        log_error "找不到 api/.env.local，請先設定環境變數"
        exit 1
    fi

    if [ "$mode" = "docker" ]; then
        # Docker 模式：建置並運行 Docker 容器
        log_info "建置 Docker 映像..."
        docker build -t "$DOCKER_IMAGE_NAME" .

        # 停止舊容器
        stop_docker_container "$DOCKER_IMAGE_NAME"

        # 釋放端口
        kill_port $API_PORT "API"

        # 從 .env.local 讀取環境變數
        log_info "從 .env.local 讀取環境變數..."

        # 提取需要的環境變數
        DATABASE_URL=$(grep "^DATABASE_URL=" .env.local | cut -d '=' -f2- | tr -d '"')
        GOOGLE_GENERATIVE_AI_API_KEY=$(grep "^GOOGLE_GENERATIVE_AI_API_KEY=" .env.local | cut -d '=' -f2- | tr -d '"')

        # Firebase Admin 變數
        FIREBASE_ADMIN_PROJECT_ID=$(grep "^FIREBASE_ADMIN_PROJECT_ID=" .env.local | cut -d '=' -f2- | tr -d '"')
        FIREBASE_ADMIN_CLIENT_EMAIL=$(grep "^FIREBASE_ADMIN_CLIENT_EMAIL=" .env.local | cut -d '=' -f2- | tr -d '"')
        FIREBASE_ADMIN_PRIVATE_KEY=$(grep "^FIREBASE_ADMIN_PRIVATE_KEY=" .env.local | cut -d '=' -f2-)

        log_success "Docker 容器啟動中: http://localhost:$API_PORT"

        docker run --name "$DOCKER_IMAGE_NAME" \
            -p $API_PORT:3001 \
            -e "DATABASE_URL=$DATABASE_URL" \
            -e "GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY" \
            -e "FIREBASE_ADMIN_PROJECT_ID=$FIREBASE_ADMIN_PROJECT_ID" \
            -e "FIREBASE_ADMIN_CLIENT_EMAIL=$FIREBASE_ADMIN_CLIENT_EMAIL" \
            -e "FIREBASE_ADMIN_PRIVATE_KEY=$FIREBASE_ADMIN_PRIVATE_KEY" \
            -e "NODE_ENV=production" \
            "$DOCKER_IMAGE_NAME"
    else
        # 非 Docker 模式：釋放端口
        kill_port $API_PORT "API"

        # 檢查依賴
        if [ ! -d "node_modules" ]; then
            log_info "安裝 API 依賴..."
            npm install
        fi

        # 生成 Prisma Client
        log_info "生成 Prisma Client..."
        npm run prisma:generate

        if [ "$mode" = "prod" ]; then
            # 生產模式：先 build 再 start
            log_info "建置生產版本..."
            npm run build

            log_success "API 啟動中 (生產模式): http://localhost:$API_PORT"
            PORT=$API_PORT npm run start
        elif [ "$mode" = "standalone" ]; then
            # Standalone 模式：模擬 Cloud Run 環境
            log_info "建置生產版本..."
            npm run build

            log_success "API 啟動中 (Standalone 模式): http://localhost:$API_PORT"
            cd "$PROJECT_ROOT/api/.next/standalone/api"
            PORT=$API_PORT node server.js
        else
            # 開發模式：使用 server.ts（同時包含 Next.js + MCP endpoint）
            # 清除 JWT secret，讓 MCP 接受假 token（fake JWT dev bypass）
            # 用環境變數覆蓋 .env 裡的值（Next.js 優先使用環境變數）
            log_success "API 啟動中 (開發模式): http://localhost:$API_PORT"
            log_info "MCP:  http://localhost:$API_PORT/mcp"
            log_warning "MCP dev bypass 已啟用（ZENTROPY_MCP_JWT_SECRET 已清除）"
            ZENTROPY_MCP_JWT_SECRET="" PORT=$API_PORT npm run dev:mcp
        fi
    fi
}

# ==============================================================================
# 主程式
# ==============================================================================
MODE=${1:-dev}

if [ "$MODE" != "dev" ] && [ "$MODE" != "prod" ] && [ "$MODE" != "standalone" ] && [ "$MODE" != "docker" ]; then
    log_error "無效的模式: $MODE"
    echo ""
    echo "使用方式:"
    echo "  ./scripts/dev-api.sh              # 開發模式"
    echo "  ./scripts/dev-api.sh prod         # 生產模式"
    echo "  ./scripts/dev-api.sh standalone   # Standalone 模式"
    echo "  ./scripts/dev-api.sh docker       # Docker 模式 (模擬 Cloud Run)"
    exit 1
fi

start_api "$MODE"
