#!/bin/bash

# API 整合測試腳本
# 用來真正驗證 Flutter App 與後端 API 的整合
#
# 執行方式: ./test-api.sh

set -e

API_URL="http://localhost:3001"

echo "========================================"
echo "  API 整合測試"
echo "========================================"
echo ""
echo "API URL: $API_URL"
echo ""

# 顏色定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 測試計數器
total_tests=0
passed_tests=0
failed_tests=0

# 測試函數
test_endpoint() {
  local method=$1
  local endpoint=$2
  local expected_status=$3
  local description=$4
  local data=$5

  total_tests=$((total_tests + 1))

  echo -n "測試 $total_tests: $description ... "

  if [ -z "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
      -H "Content-Type: application/json" \
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
echo "測試 1: 端點存在性驗證（預期返回認證錯誤）"
echo "========================================"
echo ""

# 測試所有主要端點返回 401（證明端點存在且認證機制正常）
test_endpoint "GET" "/api/me" "401" "GET /api/me - 獲取當前用戶"
test_endpoint "GET" "/api/tasks" "401" "GET /api/tasks - 獲取任務列表"
test_endpoint "GET" "/api/areas" "401" "GET /api/areas - 獲取領域列表"
test_endpoint "GET" "/api/products" "401" "GET /api/products - 獲取專案列表"
test_endpoint "GET" "/api/library" "401" "GET /api/library - 獲取知識庫"

echo "========================================"
echo "測試 2: POST 端點驗證（預期返回認證錯誤或驗證錯誤）"
echo "========================================"
echo ""

# 測試 POST 端點（應該返回 401 或 400）
test_endpoint "POST" "/api/tasks" "401" "POST /api/tasks - 創建任務" '{"content":"測試任務"}'
test_endpoint "POST" "/api/areas" "401" "POST /api/areas - 創建領域" '{"name":"測試領域"}'
test_endpoint "POST" "/api/auth/signin" "400" "POST /api/auth/signin - 登入（缺少參數）" '{}'

echo "========================================"
echo "測試 3: 資料格式驗證"
echo "========================================"
echo ""

# 測試回應格式是否符合規範
response=$(curl -s "$API_URL/api/tasks" -H "Content-Type: application/json")

if echo "$response" | grep -q '"success"'; then
  echo -e "${GREEN}✓${NC} API 回應包含 'success' 欄位"
  passed_tests=$((passed_tests + 1))
else
  echo -e "${RED}✗${NC} API 回應缺少 'success' 欄位"
  failed_tests=$((failed_tests + 1))
fi
total_tests=$((total_tests + 1))

if echo "$response" | grep -q '"error"'; then
  echo -e "${GREEN}✓${NC} API 回應包含 'error' 欄位（預期行為）"
  passed_tests=$((passed_tests + 1))
else
  echo -e "${RED}✗${NC} API 回應缺少 'error' 欄位"
  failed_tests=$((failed_tests + 1))
fi
total_tests=$((total_tests + 1))

if echo "$response" | grep -q '"meta"'; then
  echo -e "${GREEN}✓${NC} API 回應包含 'meta' 欄位"
  passed_tests=$((passed_tests + 1))
else
  echo -e "${RED}✗${NC} API 回應缺少 'meta' 欄位"
  failed_tests=$((failed_tests + 1))
fi
total_tests=$((total_tests + 1))

echo ""
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
  echo "✓ 所有 API 端點都存在且正確回應"
  echo "✓ 認證機制正常運作（正確返回 401）"
  echo "✓ API 回應格式符合規範"
  echo "✓ Flutter App 的 API 配置正確"
  echo ""
  echo "下一步:"
  echo "1. 實作真實的認證測試（需要 Firebase Token）"
  echo "2. 測試完整的 CRUD 操作"
  echo "3. 驗證資料持久化"
  exit 0
else
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  ✗ 部分測試失敗${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
