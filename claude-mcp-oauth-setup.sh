#!/bin/bash
# Zentropy MCP Server OAuth 設定腳本

echo "=========================================="
echo "Zentropy MCP Server OAuth 設定"
echo "=========================================="
echo ""

# 檢查 Claude Code 版本
echo "1️⃣  檢查 Claude Code 版本"
claude --version
echo ""

# 檢查 OAuth Discovery
echo "2️⃣  檢查 OAuth Discovery"
curl -s https://zentropy.cc/.well-known/oauth-authorization-server-metadata | jq '.'
echo ""

# 選擇設定方式
echo "=========================================="
echo "請選擇設定方式："
echo ""
echo "A. 自動設定（使用 OAuth Discovery）"
echo "B. 手動編輯設定檔"
echo "C. 開發模式（跳過 OAuth）"
echo ""
read -p "請輸入選項 (A/B/C): " choice
echo ""

case $choice in
  A|a)
    echo "執行命令："
    echo "claude mcp add --transport http --oauth https://zentropy.cc/.well-known/oauth-authorization-server-metadata zentropy https://api.zentropy.cc/mcp"
    echo ""
    echo "請手動執行上述命令（需要互動）"
    ;;

  B|b)
    echo "開啟設定檔："
    open ~/.claude/settings.json
    echo ""
    echo "請新增以下內容到 mcpServers 區塊："
    echo ""
    cat << 'EOF'
    "zentropy": {
      "url": "https://api.zentropy.cc/mcp",
      "transport": "http",
      "oauth": {
        "authorizationEndpoint": "https://zentropy.cc/api/oauth/mcp/authorize",
        "tokenEndpoint": "https://zentropy.cc/api/oauth/mcp/token",
        "clientId": "claude-code",
        "scopes": ["read:tasks", "read:knowledge", "write:inbox"],
        "pkce": true
      }
    }
EOF
    ;;

  C|c)
    echo "開發模式設定："
    echo ""
    cat << 'EOF'
    "zentropy": {
      "url": "https://api.zentropy.cc/mcp",
      "transport": "http"
    }
EOF
    echo ""
    echo "請手動加入到 ~/.claude/settings.json 的 mcpServers 區塊"
    echo ""
    echo "⚠️  注意：開發模式不需要認證，但只能在開發環境使用！"
    ;;

  *)
    echo "❌ 無效的選項"
    exit 1
    ;;
esac

echo ""
echo "=========================================="
echo "設定完成後："
echo "1. 重新啟動 Claude Code"
echo "2. 在新對話中測試："
echo "   > 使用 Zentropy MCP 的 capture tool"
echo "=========================================="
