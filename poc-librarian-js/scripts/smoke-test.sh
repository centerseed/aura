#!/usr/bin/env bash
#
# Librarian Service 冒煙測試
# 對本地或遠端服務發送 API 請求，驗證基本功能
#
# 用法：
#   ./scripts/smoke-test.sh              # 預設 localhost:8080
#   ./scripts/smoke-test.sh https://xxx  # 指定 URL
#   API_KEY=xxx ./scripts/smoke-test.sh  # 帶認證

set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
API_KEY="${API_KEY:-}"
PASSED=0
FAILED=0

# 顏色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

header() {
  echo ""
  echo -e "${YELLOW}━━━ $1 ━━━${NC}"
}

check() {
  local name="$1"
  local status="$2"
  local body="$3"

  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    echo -e "  ${GREEN}✅ $name${NC} (HTTP $status)"
    PASSED=$((PASSED + 1))
  else
    echo -e "  ${RED}❌ $name${NC} (HTTP $status)"
    echo "     Response: $body"
    FAILED=$((FAILED + 1))
  fi
}

curl_opts=(-s -w "\n%{http_code}")
if [ -n "$API_KEY" ]; then
  curl_opts+=(-H "x-api-key: $API_KEY")
fi

echo "🧪 Librarian Service 冒煙測試"
echo "   Target: $BASE_URL"
echo "   Auth:   ${API_KEY:+API Key 已設定}${API_KEY:-無}"

# ============================================================================
# 1. Health Check
# ============================================================================
header "Health Check"

response=$(curl "${curl_opts[@]}" "$BASE_URL/api/health")
status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')
check "GET /api/health" "$status" "$body"

# ============================================================================
# 2. Observe（記錄修正）
# ============================================================================
header "Observe"

response=$(curl "${curl_opts[@]}" -X POST "$BASE_URL/api/observe" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "smoke-test-user",
    "domain": "naruvia",
    "type": "correction",
    "input": "買 MacBook Pro 給工程師",
    "aiPrediction": {"category": "個人娛樂"},
    "userCorrection": {"category": "公司資產"}
  }')
status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')
check "POST /api/observe" "$status" "$body"

# ============================================================================
# 3. Recall（檢索規則）
# ============================================================================
header "Recall"

response=$(curl "${curl_opts[@]}" -X POST "$BASE_URL/api/recall" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "smoke-test-user",
    "domain": "naruvia",
    "input": "買新筆電"
  }')
status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')
check "POST /api/recall" "$status" "$body"

# ============================================================================
# 4. Get Rules
# ============================================================================
header "Get Rules"

response=$(curl "${curl_opts[@]}" "$BASE_URL/api/rules/smoke-test-user?domain=naruvia")
status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')
check "GET /api/rules/:userId" "$status" "$body"

# ============================================================================
# 5. Validation: missing fields
# ============================================================================
header "Validation"

response=$(curl "${curl_opts[@]}" -X POST "$BASE_URL/api/observe" \
  -H "Content-Type: application/json" \
  -d '{"userId": "test"}')
status=$(echo "$response" | tail -1)
body=$(echo "$response" | sed '$d')

if [ "$status" -eq 400 ]; then
  echo -e "  ${GREEN}✅ 缺少欄位回傳 400${NC}"
  PASSED=$((PASSED + 1))
else
  echo -e "  ${RED}❌ 預期 400，得到 $status${NC}"
  FAILED=$((FAILED + 1))
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━"
TOTAL=$((PASSED + FAILED))
echo -e "結果: ${GREEN}$PASSED passed${NC} / ${RED}$FAILED failed${NC} / $TOTAL total"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi
