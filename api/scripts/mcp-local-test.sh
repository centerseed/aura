#!/bin/bash
# MCP Local Test Script
#
# 直接透過 Streamable HTTP 呼叫本地 MCP server，不需要 OAuth 流程。
# 僅適用於開發模式（ZENTROPY_MCP_JWT_SECRET 未設定時）。
#
# Usage:
#   ./api/scripts/mcp-local-test.sh <tool_name> <user_id> '<json_args>'
#
# Examples:
#   ./api/scripts/mcp-local-test.sh list_products "your-user-id" '{}'
#   ./api/scripts/mcp-local-test.sh list_tasks "your-user-id" '{}'
#   ./api/scripts/mcp-local-test.sh capture "your-user-id" '{"content":"測試","source":"mcp-client","mode":"thought"}'
#   ./api/scripts/mcp-local-test.sh get_plan "your-user-id" '{}'
#
# 前置條件：
#   1. 啟動 local server（另一個 terminal）：
#      cd api && npx tsx watch ../server.ts
#   2. 確認 ZENTROPY_MCP_JWT_SECRET 未設定（或 unset 它）

set -e

TOOL="${1:-list_tasks}"
USER_ID="${2:-dev-user}"
INPUT="${3:-{}}"
MCP_URL="${MCP_URL:-http://localhost:3002/mcp}"

# 驗證 jq 是否可用
if ! command -v jq &> /dev/null; then
  echo "Error: jq 未安裝。請執行: brew install jq" >&2
  exit 1
fi

# 構造 fake JWT（dev 模式不驗簽名，只 base64 decode payload）
HEADER=$(echo -n '{"alg":"none","typ":"JWT"}' | base64 | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(printf '{"sub":"%s","scope":"read:tasks write:inbox write:knowledge read:knowledge read:profile trigger:librarian","exp":9999999999}' "$USER_ID" | base64 | tr '+/' '-_' | tr -d '=')
TOKEN="${HEADER}.${PAYLOAD}.dev_sig"

echo "=== MCP Local Test ===" >&2
echo "URL:     $MCP_URL" >&2
echo "Tool:    $TOOL" >&2
echo "User ID: $USER_ID" >&2
echo "Input:   $INPUT" >&2
echo "" >&2

# Step 1: 初始化 session，取得 mcp-session-id
echo "[1/2] 初始化 MCP session..." >&2
INIT_RESPONSE=$(curl -s -D /tmp/mcp-headers.txt -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"mcp-local-test","version":"0.1"}}}')

# 從 response headers 取得 session ID
SESSION_ID=$(grep -i "^mcp-session-id:" /tmp/mcp-headers.txt | awk '{print $2}' | tr -d '\r\n')
rm -f /tmp/mcp-headers.txt

if [ -z "$SESSION_ID" ]; then
  echo "Error: 無法取得 mcp-session-id。請確認 server 已啟動。" >&2
  echo "Initialize 回應：" >&2
  echo "$INIT_RESPONSE" | jq . 2>/dev/null || echo "$INIT_RESPONSE" >&2
  exit 1
fi

echo "Session ID: $SESSION_ID" >&2
echo "" >&2

# Step 2: 呼叫 tool
echo "[2/2] 呼叫 tool: $TOOL..." >&2

CALL_BODY=$(printf '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"%s","arguments":%s}}' "$TOOL" "$INPUT")

RESULT=$(curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "mcp-session-id: $SESSION_ID" \
  -d "$CALL_BODY")

echo "=== Result ===" >&2
DATA_LINE=$(echo "$RESULT" | grep '^data:' || true)
if [ -z "$DATA_LINE" ]; then
  echo "$RESULT"
  exit 0
fi
echo "$DATA_LINE" | sed 's/^data: //' | jq -r '
  if .result.content[0].text then .result.content[0].text
  elif .error then (.error | tostring)
  else (. | tostring)
  end
' | jq .
