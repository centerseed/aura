#!/usr/bin/env bash
#
# 部署 Librarian Service 到 Cloud Run
#
# 前提：
#   1. 已安裝 gcloud CLI 並登入
#   2. 已設定 GCP project
#   3. 已在 Neon 建立資料庫
#
# 用法：
#   ./scripts/deploy.sh                    # 使用預設值
#   SERVICE_NAME=xxx ./scripts/deploy.sh   # 自訂服務名稱
#
# 環境變數（可選）：
#   SERVICE_NAME  - Cloud Run 服務名稱（預設 librarian-service）
#   REGION        - GCP 區域（預設 asia-east1）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

# ============================================================================
# 設定
# ============================================================================
SERVICE_NAME="${SERVICE_NAME:-librarian-service}"
REGION="${REGION:-asia-east1}"
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ]; then
  echo "❌ 未設定 GCP project，請先執行："
  echo "   gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 部署 Librarian Service"
echo "   Project:  $PROJECT_ID"
echo "   Service:  $SERVICE_NAME"
echo "   Region:   $REGION"
echo "   Image:    $IMAGE"
echo ""

# ============================================================================
# 1. 確認 .env 已設定（取得 secrets）
# ============================================================================
if [ ! -f .env ]; then
  echo "❌ .env 不存在，需要讀取 DATABASE_URL 和 API keys"
  exit 1
fi

eval "$(grep -v '^#' .env | grep -v '^\s*$' | sed 's/^/export /')"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL 未設定"
  exit 1
fi

if [ -z "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ] || [ "$GOOGLE_GENERATIVE_AI_API_KEY" = "your-api-key-here" ]; then
  echo "❌ GOOGLE_GENERATIVE_AI_API_KEY 未設定"
  exit 1
fi

# 生成 API Key（如果未設定）
LIBRARIAN_API_KEY="${LIBRARIAN_API_KEY:-$(openssl rand -hex 32)}"
echo "🔑 LIBRARIAN_API_KEY: ${LIBRARIAN_API_KEY:0:8}..."

# ============================================================================
# 2. 初始化遠端 DB（冪等操作）
# ============================================================================
echo ""
echo "📦 確認遠端資料庫 schema..."
npx tsx scripts/init-neon-db.ts

# ============================================================================
# 3. Build & Push Docker image
# ============================================================================
echo ""
echo "🐳 建置 Docker image..."
gcloud builds submit --tag "$IMAGE" .

# ============================================================================
# 4. Deploy to Cloud Run
# ============================================================================
echo ""
echo "☁️  部署到 Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL" \
  --set-env-vars "GOOGLE_GENERATIVE_AI_API_KEY=$GOOGLE_GENERATIVE_AI_API_KEY" \
  --set-env-vars "LIBRARIAN_API_KEY=$LIBRARIAN_API_KEY"

# ============================================================================
# 5. 取得 URL 並執行冒煙測試
# ============================================================================
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" --format 'value(status.url)')

echo "✅ 部署完成！"
echo "   URL: $SERVICE_URL"
echo "   API Key: $LIBRARIAN_API_KEY"
echo ""
echo "🧪 執行冒煙測試..."
API_KEY="$LIBRARIAN_API_KEY" bash scripts/smoke-test.sh "$SERVICE_URL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 整合說明："
echo ""
echo "Naruvia (Next.js):"
echo "  LIBRARIAN_URL=$SERVICE_URL"
echo "  LIBRARIAN_API_KEY=$LIBRARIAN_API_KEY"
echo ""
echo "Paceriz (Flask):"
echo "  LIBRARIAN_URL=$SERVICE_URL"
echo "  LIBRARIAN_API_KEY=$LIBRARIAN_API_KEY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
