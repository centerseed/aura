#!/bin/bash

# OAuth 自動化設置腳本（半自動化）
# 注意：OAuth Consent Screen 仍需手動設置一次

set -e

PROJECT_ID=${1:-"your-firebase-project-id"}
REDIRECT_URI="http://localhost:3002/api/oauth/callback"

echo "🔧 設置 Google Cloud OAuth..."
echo "Project ID: $PROJECT_ID"

# 1. 啟用 Calendar API
echo "📅 啟用 Google Calendar API..."
gcloud services enable calendar-json.googleapis.com --project=$PROJECT_ID

# 2. 檢查 OAuth Consent Screen 是否已設置
echo "⚠️  注意：OAuth Consent Screen 需要手動設置"
echo "請前往: https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""
read -p "已完成 Consent Screen 設置？(y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ 請先完成 OAuth Consent Screen 設置"
    exit 1
fi

# 3. 創建 OAuth Client ID（需要 OAuth2 Brand 已存在）
echo "🔑 創建 OAuth 2.0 Client ID..."

# 注意：這個命令可能會失敗，因為需要先有 Consent Screen
# 如果失敗，仍需手動創建
gcloud alpha iap oauth-clients create \
    --project=$PROJECT_ID \
    --display_name="Zentropy Web" 2>/dev/null || {
    echo "❌ 自動創建失敗，請手動創建 OAuth Client"
    echo "前往: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
    exit 1
}

echo "✅ 基礎設置完成！"
echo ""
echo "下一步："
echo "1. 前往 Cloud Console 取得 Client ID 和 Secret"
echo "2. 設置 Redirect URI: $REDIRECT_URI"
echo "3. 將 credentials 寫入 api/.env"
