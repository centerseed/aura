#!/bin/bash
# ==============================================================================
# setup-test-db.sh - 自動設置測試資料庫
# ==============================================================================
#
# 功能：
# 1. 自動啟動 Docker PostgreSQL（如果尚未運行）
# 2. 等待資料庫就緒
# 3. 運行 Prisma migrations
# 4. 啟用 pgvector 擴展
#
# 使用方式：
#   ./scripts/setup-test-db.sh        # 設置並啟動測試 DB
#   ./scripts/setup-test-db.sh stop   # 停止測試 DB
#   ./scripts/setup-test-db.sh clean  # 清理並重建測試 DB
#
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Docker 容器配置
CONTAINER_NAME="naruvia-test-db"
POSTGRES_USER="naruvia"
POSTGRES_PASSWORD="naruvia_password"
POSTGRES_DB="naruvia_db"
POSTGRES_PORT=5432

# 顏色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# ==============================================================================
# 檢查 Docker 是否可用
# ==============================================================================
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安裝。請先安裝 Docker Desktop。"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker daemon 未運行。請啟動 Docker Desktop。"
        exit 1
    fi
}

# ==============================================================================
# 啟動 PostgreSQL 容器
# ==============================================================================
start_container() {
    # 檢查容器是否已存在
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        # 容器存在，檢查是否運行中
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            log_info "測試資料庫已在運行中"
            return 0
        else
            # 容器存在但未運行，啟動它
            log_info "啟動現有容器..."
            docker start "$CONTAINER_NAME"
        fi
    else
        # 容器不存在，創建新容器
        log_info "創建新的 PostgreSQL 容器..."
        docker run -d \
            --name "$CONTAINER_NAME" \
            -e POSTGRES_USER="$POSTGRES_USER" \
            -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
            -e POSTGRES_DB="$POSTGRES_DB" \
            -p "$POSTGRES_PORT:5432" \
            postgres:16-alpine
    fi

    # 等待資料庫就緒
    log_info "等待 PostgreSQL 就緒..."
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec "$CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" &> /dev/null; then
            log_success "PostgreSQL 已就緒"
            return 0
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done

    log_error "PostgreSQL 啟動超時"
    return 1
}

# ==============================================================================
# 設置資料庫 schema
# ==============================================================================
setup_schema() {
    cd "$PROJECT_ROOT"

    # 設置環境變數
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"

    # 啟用 pgvector 擴展
    log_info "啟用 pgvector 擴展..."
    docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

    # 推送 schema
    log_info "推送 Prisma schema..."
    npx prisma db push --skip-generate --accept-data-loss 2>&1 | grep -v "^Prisma schema" || true

    log_success "資料庫 schema 已設置"
}

# ==============================================================================
# 停止容器
# ==============================================================================
stop_container() {
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_info "停止測試資料庫..."
        docker stop "$CONTAINER_NAME"
        log_success "測試資料庫已停止"
    else
        log_info "測試資料庫未運行"
    fi
}

# ==============================================================================
# 清理並重建
# ==============================================================================
clean_container() {
    log_info "清理測試資料庫..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    log_success "測試資料庫已清理"

    # 重新創建
    start_container
    setup_schema
}

# ==============================================================================
# 主程式
# ==============================================================================
main() {
    local command=${1:-start}

    case "$command" in
        start)
            check_docker
            start_container
            setup_schema
            echo ""
            log_success "測試資料庫已就緒: postgresql://${POSTGRES_USER}:***@localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
            ;;
        stop)
            stop_container
            ;;
        clean)
            check_docker
            clean_container
            ;;
        status)
            if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
                log_success "測試資料庫運行中"
                docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
            else
                log_warning "測試資料庫未運行"
            fi
            ;;
        *)
            echo "使用方式: $0 {start|stop|clean|status}"
            exit 1
            ;;
    esac
}

main "$@"
