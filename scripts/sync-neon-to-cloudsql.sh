#!/bin/bash
# ==============================================================================
# sync-neon-to-cloudsql.sh — 從 Neon 同步資料到 Cloud SQL
# ==============================================================================
#
# 前提：本地已啟動 Cloud SQL Auth Proxy（port 5433）
#   cloud-sql-proxy zentropy-4f7a5:asia-east1:zentropy-db --port=5433 &
#
# 用法：
#   ./scripts/sync-neon-to-cloudsql.sh
#
# ==============================================================================

set -euo pipefail

export PATH="/opt/homebrew/opt/libpq/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

echo ""
log_info "======================================"
log_info "   Neon → Cloud SQL 資料同步"
log_info "======================================"
echo ""

# ==============================================================================
# 1. 讀取設定
# ==============================================================================
ENV_FILE="$PROJECT_ROOT/api/.env"
if [ ! -f "$ENV_FILE" ]; then
  log_error "找不到 $ENV_FILE，需要 DATABASE_URL（Neon）和 CLOUDSQL_URL"
  exit 1
fi

get_env() {
  grep "^${1}=" "$ENV_FILE" | cut -d '=' -f 2- | sed "s/^[\"']//;s/[\"']$//"
}

# 優先用 NEON_DATABASE_URL；沒有才 fallback 到 DATABASE_URL
NEON_URL=$(get_env "NEON_DATABASE_URL")
if [ -z "$NEON_URL" ]; then
  NEON_URL=$(get_env "DATABASE_URL")
fi
# 移除 psql 不支援的 Neon 專有參數
NEON_URL=$(echo "$NEON_URL" | sed 's/&pool_timeout=[^&]*//g; s/?pool_timeout=[^&]*&/?/g; s/?pool_timeout=[^&]*$//g')
CLOUDSQL_URL=$(get_env "CLOUDSQL_DATABASE_URL")

if [ -z "$NEON_URL" ]; then
  log_error "DATABASE_URL 未設定於 $ENV_FILE"
  exit 1
fi

# CLOUDSQL_URL 供 app 用（naruvia_api）
# CLOUDSQL_RESTORE_URL 供 pg_restore 用（postgres superuser）
POSTGRES_PW=$(get_env "CLOUDSQL_POSTGRES_PASSWORD")
if [ -z "$POSTGRES_PW" ]; then
  log_error "請在 api/.env 設定 CLOUDSQL_POSTGRES_PASSWORD"
  exit 1
fi
CLOUDSQL_RESTORE_URL="postgresql://postgres:${POSTGRES_PW}@127.0.0.1:5433/neondb"

if [ -z "$CLOUDSQL_URL" ]; then
  CLOUDSQL_URL="$CLOUDSQL_RESTORE_URL"
fi

# 隱藏密碼用於顯示
NEON_DISPLAY=$(echo "$NEON_URL" | sed 's/:[^@]*@/:***@/')
CLOUDSQL_DISPLAY=$(echo "$CLOUDSQL_URL" | sed 's/:[^@]*@/:***@/')

log_info "來源（Neon）：    $NEON_DISPLAY"
log_info "目標（Cloud SQL）：$CLOUDSQL_DISPLAY"
echo ""

# ==============================================================================
# 2. 檢查 Auth Proxy 是否在運行
# ==============================================================================
log_info "檢查 Cloud SQL Auth Proxy..."
if ! /opt/homebrew/opt/libpq/bin/pg_isready -h 127.0.0.1 -p 5433 -q 2>/dev/null; then
  log_error "Cloud SQL Auth Proxy 未啟動，請先執行："
  echo "  cloud-sql-proxy zentropy-4f7a5:asia-east1:zentropy-db --port=5433 &"
  exit 1
fi
log_success "Auth Proxy 正常運行"
echo ""

# ==============================================================================
# 3. 記錄同步前的資料筆數
# ==============================================================================
log_info "同步前 — Neon 資料筆數："
/opt/homebrew/opt/libpq/bin/psql "$NEON_URL" -c "
SELECT tablename,
  (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM ' || quote_ident(tablename), false, true, '')))[1]::text::int AS rows
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
" 2>&1

echo ""

# ==============================================================================
# 4. pg_dump 從 Neon
# ==============================================================================
DUMP_FILE="/tmp/neon_backup_$(date +%Y%m%d_%H%M%S).dump"
log_info "開始 pg_dump (Neon -> ${DUMP_FILE})..."

/opt/homebrew/opt/libpq/bin/pg_dump \
  "$NEON_URL" \
  --no-owner --no-acl \
  --schema=public \
  --exclude-table="_prisma_migrations" \
  -Fc \
  -f "$DUMP_FILE" 2>&1

DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
log_success "pg_dump 完成，大小：$DUMP_SIZE"
echo ""

# ==============================================================================
# 5. pg_restore 到 Cloud SQL
# ==============================================================================
log_info "開始 pg_restore 到 Cloud SQL..."

/opt/homebrew/opt/libpq/bin/pg_restore \
  -d "$CLOUDSQL_RESTORE_URL" \
  --no-owner --no-acl \
  --clean --if-exists \
  -v \
  "$DUMP_FILE" 2>&1 | grep -E "^(pg_restore:|creating|dropping|error)" | head -50 || true

log_success "pg_restore 完成"
echo ""

# ==============================================================================
# 6. 確保 pgvector 仍然啟用（restore 可能覆蓋）
# ==============================================================================
log_info "確認 pgvector extension..."
/opt/homebrew/opt/libpq/bin/psql "$CLOUDSQL_RESTORE_URL" \
  -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>&1
log_success "pgvector 已確認"
echo ""

# ==============================================================================
# 7. 重新授權 naruvia_api（restore 可能重建 schema）
# ==============================================================================
log_info "重新授權 naruvia_api..."
/opt/homebrew/opt/libpq/bin/psql "$CLOUDSQL_RESTORE_URL" -c "
GRANT ALL ON ALL TABLES IN SCHEMA public TO naruvia_api;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO naruvia_api;
GRANT USAGE ON SCHEMA public TO naruvia_api;
" 2>&1
log_success "naruvia_api 授權完成"
echo ""

# ==============================================================================
# 8. 驗證同步結果
# ==============================================================================
log_info "同步後 — Cloud SQL 資料筆數："
/opt/homebrew/opt/libpq/bin/psql "$CLOUDSQL_RESTORE_URL" -c "
SELECT tablename,
  (xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM ' || quote_ident(tablename), false, true, '')))[1]::text::int AS rows
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
" 2>&1

echo ""

# 清理 dump 檔
rm -f "$DUMP_FILE"
log_info "已清理暫存 dump 檔"

echo ""
log_success "======================================"
log_success "   同步完成！"
log_success "======================================"
echo ""
