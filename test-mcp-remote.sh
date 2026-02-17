#!/bin/bash
# Zentropy MCP Server 遠端測試腳本

MCP_URL="https://zentropy-api-894512935237.asia-east1.run.app/mcp"

echo "=========================================="
echo "Zentropy MCP Server 測試"
echo "=========================================="
echo ""

# 1. Health Check
echo "1️⃣  Health Check"
echo "---"
curl -s https://zentropy-api-894512935237.asia-east1.run.app/health | jq '.'
echo ""
echo ""

# 2. 列出所有 Tools
echo "2️⃣  列出所有 Tools"
echo "---"
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }' | jq '.result.tools[] | {name: .name, description: .description}'
echo ""
echo ""

# 3. 列出所有 Resources
echo "3️⃣  列出所有 Resources"
echo "---"
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/list",
    "id": 2
  }' | jq '.result.resources[] | {uri: .uri, name: .name, description: .description}'
echo ""
echo ""

# 4. 測試 capture tool
echo "4️⃣  測試 capture tool（捕捉想法）"
echo "---"
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "capture",
      "arguments": {
        "content": "測試從遠端 MCP 捕捉想法",
        "source": "terminal-test",
        "mode": "thought"
      }
    },
    "id": 3
  }' | jq '.'
echo ""
echo ""

# 5. 讀取 Resource (handoff-ready)
echo "5️⃣  讀取 handoff-ready Resource"
echo "---"
curl -s -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "resources/read",
    "params": {
      "uri": "zentropy://handoff/ready"
    },
    "id": 4
  }' | jq '.result.contents[0].text' -r | jq '.'
echo ""
echo ""

echo "=========================================="
echo "測試完成！"
echo "=========================================="
