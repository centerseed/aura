#!/usr/bin/env bash
#
# 本地開發啟動腳本
# 確認環境 → 初始化 DB（如需要）→ 啟動 server
#
# 用法：./scripts/dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🚀 Librarian Service 本地開發"
echo ""

# ============================================================================
# 1. 檢查 .env
# ============================================================================
if [ ! -f .env ]; then
  echo "❌ .env 不存在，請從 .env.example 複製並填入設定："
  echo "   cp .env.example .env"
  exit 1
fi

# 載入 .env 檢查必要欄位
source <(grep -v '^#' .env | grep -v '^\s*$' | sed 's/^/export /')

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 未設定"
  exit 1
fi

if [ -z "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ] || [ "$GOOGLE_GENERATIVE_AI_API_KEY" = "your-api-key-here" ]; then
  echo "⚠️  GOOGLE_GENERATIVE_AI_API_KEY 未設定（observe/recall 需要 Gemini API）"
fi

echo "✅ 環境變數已載入"

# ============================================================================
# 2. 檢查 node_modules
# ============================================================================
if [ ! -d node_modules ]; then
  echo "📦 安裝依賴..."
  npm install
fi

# ============================================================================
# 3. 初始化 DB（冪等操作，重複執行安全）
# ============================================================================
echo ""
echo "📦 確認資料庫 schema..."
npx tsx scripts/init-neon-db.ts

# ============================================================================
# 4. 啟動 server
# ============================================================================
echo ""
echo "🚀 啟動 Librarian Service..."
echo "   URL: http://localhost:${PORT:-8080}"
echo "   按 Ctrl+C 停止"
echo ""

npx tsx --watch src/server.ts
