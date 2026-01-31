#!/bin/bash

# 真實認證的 API 整合測試腳本
# 使用 Firebase Authentication REST API 獲取 ID Token
# 然後測試所有需要認證的 API 端點
#
# 執行方式: ./test-api-authenticated.sh

set -e

API_URL="http://localhost:3001"
FIREBASE_API_KEY="REDACTED_FIREBASE_API_KEY"  # 從 firebase_options.dart (Web) 獲取
TEST_EMAIL="test@zentropy.cc"
TEST_PASSWORD="123456"

echo "========================================"
echo "  真實認證 API 整合測試"
echo "========================================"
echo ""
echo "API URL: $API_URL"
echo "測試帳戶: $TEST_EMAIL"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 測試計數器
total_tests=0
passed_tests=0
failed_tests=0

echo "========================================"
echo "步驟 1: 使用 Firebase REST API 登入"
echo "========================================"
echo ""

# 使用 Firebase Auth REST API 登入
# 文檔: https://firebase.google.com/docs/reference/rest/auth
login_response=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"returnSecureToken\":true}")

# 檢查是否成功
if echo "$login_response" | grep -q "idToken"; then
  echo -e "${GREEN}✓ Firebase 登入成功${NC}"

  # 提取 ID Token (使用 grep 和 cut)
  ID_TOKEN=$(echo "$login_response" | grep "idToken" | cut -d'"' -f4)

  if [ -z "$ID_TOKEN" ]; then
    echo -e "${RED}✗ 無法提取 ID Token${NC}"
    echo "   DEBUG: 回應內容前 500 字元:"
    echo "   $login_response" | head -c 500
    echo ""
    exit 1
  fi

  echo "   ID Token 長度: ${#ID_TOKEN} 字元"
  echo "   Token 前綴: ${ID_TOKEN:0:20}..."
  echo ""
else
  echo -e "${RED}✗ Firebase 登入失敗${NC}"
  echo "   回應: $login_response"
  exit 1
fi

# 測試函數
test_authenticated_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4
  local data=$5

  total_tests=$((total_tests + 1))

  echo -n "測試 $total_tests: $description ... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ID_TOKEN" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $ID_TOKEN" \
      -d "$data" 2>&1)
  fi

  # 提取狀態碼（最後一行）
  status_code=$(echo "$response" | tail -n 1)
  # 提取響應體（除了最後一行）
  body=$(echo "$response" | sed '$d')

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (狀態碼: $status_code)"
    passed_tests=$((passed_tests + 1))

    # 顯示響應體（僅前 200 字元）
    if [ ! -z "$body" ]; then
      echo "   回應: $(echo "$body" | head -c 200)"
    fi
  else
    echo -e "${RED}✗ FAIL${NC} (預期: $expected_status, 實際: $status_code)"
    failed_tests=$((failed_tests + 1))
    echo "   回應: $body"
  fi
  echo ""
}

echo "========================================"
echo "步驟 2: 創建或登入用戶"
echo "========================================"
echo ""

# 調用 signin API 來創建或登入用戶
signin_response=$(curl -s -X POST "$API_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d "{\"provider\":\"email\",\"email\":\"$TEST_EMAIL\",\"name\":\"測試用戶\",\"providerId\":\"b1MHYIFidPaJKisUmUk25CXG6c33\"}")

if echo "$signin_response" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ 用戶登入/創建成功${NC}"
  echo "   回應: $(echo "$signin_response" | head -c 150)"
  echo ""
else
  echo -e "${RED}✗ 用戶登入/創建失敗${NC}"
  echo "   回應: $signin_response"
  echo ""
fi

echo "========================================"
echo "步驟 3: 測試認證端點 (預期 200)"
echo "========================================"
echo ""

# 測試需要認證的端點（應該都返回 200）
test_authenticated_endpoint "GET" "/api/me" "200" "GET /api/me - 獲取當前用戶"
test_authenticated_endpoint "GET" "/api/tasks" "200" "GET /api/tasks - 獲取任務列表"
test_authenticated_endpoint "GET" "/api/areas" "200" "GET /api/areas - 獲取領域列表"
test_authenticated_endpoint "GET" "/api/products" "200" "GET /api/products - 獲取專案列表"
test_authenticated_endpoint "GET" "/api/library" "200" "GET /api/library - 獲取知識庫"

echo "========================================"
echo "步驟 4: 測試 CRUD 操作"
echo "========================================"
echo ""

# 先創建 Area 和 Product
echo -e "${BLUE}4.1 創建 Area${NC}"
area_response=$(curl -s -X POST "$API_URL/api/areas" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"name":"測試領域 - '"$(date +%s)"'","color":"#667eea"}')

AREA_ID=$(echo "$area_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$AREA_ID" ]; then
  echo -e "${GREEN}✓ Area 創建成功${NC}"
  echo "   Area ID: $AREA_ID"
  echo ""
else
  echo -e "${RED}✗ Area 創建失敗${NC}"
  echo "   回應: $area_response"
  echo ""
fi

echo -e "${BLUE}4.2 創建 Product${NC}"
product_response=$(curl -s -X POST "$API_URL/api/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"name":"測試專案 - '"$(date +%s)"'","areaId":"'"$AREA_ID"'"}')

PRODUCT_ID=$(echo "$product_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ ! -z "$PRODUCT_ID" ]; then
  echo -e "${GREEN}✓ Product 創建成功${NC}"
  echo "   Product ID: $PRODUCT_ID"
  echo ""
else
  echo -e "${RED}✗ Product 創建失敗${NC}"
  echo "   回應: $product_response"
  echo ""
fi

# 創建任務
echo -e "${BLUE}4.3 創建任務${NC}"
create_response=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ID_TOKEN" \
  -d '{"content":"整合測試任務 - '"$(date +%s)"'","status":"INBOX","product_id":"'"$PRODUCT_ID"'"}')

if echo "$create_response" | grep -q '"success":true'; then
  echo -e "${GREEN}✓ 任務創建成功${NC}"
  passed_tests=$((passed_tests + 1))

  # 提取任務 ID
  TASK_ID=$(echo "$create_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   任務 ID: $TASK_ID"
  echo ""
else
  echo -e "${RED}✗ 任務創建失敗${NC}"
  echo "   回應: $create_response"
  failed_tests=$((failed_tests + 1))
fi
total_tests=$((total_tests + 1))

# 如果創建成功，繼續測試更新和刪除
if [ ! -z "$TASK_ID" ]; then
  # 更新任務
  echo -e "${BLUE}4.4 更新任務狀態${NC}"
  update_response=$(curl -s -X PATCH "$API_URL/api/tasks/$TASK_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ID_TOKEN" \
    -d '{"status":"ACTIVE"}')

  if echo "$update_response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ 任務更新成功${NC}"
    passed_tests=$((passed_tests + 1))
  else
    echo -e "${RED}✗ 任務更新失敗${NC}"
    echo "   回應: $update_response"
    failed_tests=$((failed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  echo ""

  # 刪除任務
  echo -e "${BLUE}4.5 刪除任務${NC}"
  delete_response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_URL/api/tasks/$TASK_ID" \
    -H "Authorization: Bearer $ID_TOKEN")

  delete_status=$(echo "$delete_response" | tail -n 1)

  if [ "$delete_status" = "200" ]; then
    echo -e "${GREEN}✓ 任務刪除成功${NC}"
    passed_tests=$((passed_tests + 1))
  else
    echo -e "${RED}✗ 任務刪除失敗 (狀態碼: $delete_status)${NC}"
    failed_tests=$((failed_tests + 1))
  fi
  total_tests=$((total_tests + 1))
  echo ""
fi

echo "========================================"
echo "測試結果總結"
echo "========================================"
echo ""
echo "總測試數: $total_tests"
echo -e "${GREEN}通過: $passed_tests${NC}"
if [ $failed_tests -gt 0 ]; then
  echo -e "${RED}失敗: $failed_tests${NC}"
else
  echo -e "失敗: $failed_tests"
fi
echo ""

if [ $failed_tests -eq 0 ]; then
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  ✓ 所有測試通過！${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo "結論:"
  echo "✓ Firebase 認證正常運作"
  echo "✓ 所有需要認證的 API 端點都正確回應"
  echo "✓ CRUD 操作完整測試通過"
  echo "✓ Flutter App 與後端 API 整合成功！"
  echo ""
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  ✗ 部分測試失敗${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
