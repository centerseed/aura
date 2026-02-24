#!/bin/bash
# MCP Search 工具除錯腳本

set -e

API_URL="https://api.zentropy.cc"

echo "=== MCP Search Tool 除錯 ==="
echo ""

# 1. 檢查 Health Endpoint
echo "1. 檢查 API 健康狀態..."
HEALTH=$(curl -s "${API_URL}/health")
echo "${HEALTH}" | jq '.'
echo ""

# 2. 檢查環境變數
echo "2. 檢查 GOOGLE_GENERATIVE_AI_API_KEY 環境變數..."
gcloud run services describe zentropy-api \
  --region asia-east1 \
  --project zentropy-4f7a5 \
  --format="value(spec.template.spec.containers[0].env[?name=='GOOGLE_GENERATIVE_AI_API_KEY'].valueFrom.secretKeyRef.name)" 2>&1 || echo "查詢失敗"
echo ""

# 3. 檢查最近的錯誤日誌
echo "3. 檢查最近 1 小時的錯誤日誌..."
gcloud logging read \
  'resource.type="cloud_run_revision"
   resource.labels.service_name="zentropy-api"
   severity>=ERROR
   timestamp>="'"$(date -u -v-1H '+%Y-%m-%dT%H:%M:%SZ')"'"' \
  --limit 5 \
  --project zentropy-4f7a5 \
  --format="table(timestamp,severity,textPayload)" 2>&1 || echo "無錯誤日誌或查詢失敗"
echo ""

# 4. 模擬 MCP search 呼叫（需要真實的 OAuth token）
echo "4. 提示：請透過 Claude Code 執行以下 MCP 工具測試："
echo "   await mcp.search({ query: '脈輪' })"
echo ""
echo "   錯誤訊息應該會顯示詳細的失敗原因。"
