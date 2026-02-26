#!/usr/bin/env bash
#
# 部署 Librarian Service 到 Cloud Run
#
# 前提：
#   1. 已安裝 gcloud CLI 並登入
#   2. 已設定 GCP project
#   3. Cloud SQL instance zentropy-4f7a5:asia-east1:zentropy-db 已就緒
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
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PROJECT_DIR="$REPO_ROOT/poc-librarian-js"

cd "$PROJECT_DIR"

# ============================================================================
# 設定
# ============================================================================
SERVICE_NAME="${SERVICE_NAME:-librarian-service}"
REGION="${REGION:-asia-east1}"
REQUIRED_PROJECT="zentropy-4f7a5"

# 🚨 強制 project 檢查 — 只允許部署到 zentropy-4f7a5
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")

if [ "$PROJECT_ID" != "$REQUIRED_PROJECT" ]; then
  echo "🚨 當前 GCP project 是 '$PROJECT_ID'，不是 '$REQUIRED_PROJECT'"
  echo "   自動切換..."
  gcloud config set project "$REQUIRED_PROJECT"
  PROJECT_ID="$REQUIRED_PROJECT"
fi

IMAGE="asia-east1-docker.pkg.dev/$PROJECT_ID/zentropy-images/$SERVICE_NAME"

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
  --add-cloudsql-instances "zentropy-4f7a5:asia-east1:zentropy-db" \
  --set-env-vars "NODE_ENV=production" \
  --update-secrets "DATABASE_URL=librarian-database-url:latest" \
  --update-secrets "GOOGLE_GENERATIVE_AI_API_KEY=gemini-api-key:latest" \
  --update-secrets "LIBRARIAN_API_KEY=librarian-api-key:latest"

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

# ============================================================================
# 6. 清理舊 container images（保留最近 2 個）
# ============================================================================
echo ""
echo "🧹 清理舊 container images（保留最近 2 個）..."
OLD_DIGESTS=$(gcloud artifacts docker images list "$IMAGE" \
  --project "$PROJECT_ID" \
  --sort-by="~UPDATE_TIME" \
  --format="value(version)" \
  --limit=999 2>/dev/null | tail -n +3)

if [ -n "$OLD_DIGESTS" ]; then
  DELETED=0
  for DIGEST in $OLD_DIGESTS; do
    echo "   刪除: ${DIGEST:0:20}..."
    gcloud artifacts docker images delete "${IMAGE}@${DIGEST}" \
      --project "$PROJECT_ID" --quiet 2>/dev/null && DELETED=$((DELETED+1)) || true
  done
  echo "✅ 已清理 ${DELETED} 個舊 image"
else
  echo "✅ 沒有需要清理的舊 image"
fi

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
