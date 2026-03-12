# Zentropy MCP Server - 快速開始

## ✅ 狀態確認

- **MCP Server URL**: `https://zentropy.cc/mcp`
- **Health Check**: `https://zentropy.cc/health` ✅ 正常
- **OAuth Discovery**: `https://zentropy.cc/.well-known/oauth-authorization-server-metadata` ✅ 正常

---

## 🚀 立即開始（2 步驟）

### 步驟 1：新增 MCP Server

在終端機執行以下命令：

```bash
claude mcp add \
  --transport http \
  zentropy \
  https://zentropy.cc/mcp
```

**說明**：
- 目前 MCP Server 運行在**開發模式**（不需要 OAuth）
- 這個設定會立即生效，無需重啟

### 步驟 2：測試

開啟一個**新的 Claude Code 對話**，輸入：

```
列出所有可用的 MCP servers
```

或直接測試：

```
使用 Zentropy MCP 的 capture tool，內容：「測試 MCP 整合成功」
```

---

## Codex 設定（不走 OAuth）

Codex 目前可直接在 `~/.codex/config.toml` 設定 remote MCP URL，但不適合直接使用 Zentropy 的 OAuth browser flow。

### 1. 先用已登入的 Zentropy session 換一顆 Personal Access Token

```bash
curl -s \
  -X POST https://api.zentropy.cc/api/mcp/personal-token \
  -H "Authorization: Bearer <你的 Firebase ID token>" \
  -H "Content-Type: application/json" \
  -d '{"client_name":"codex","expires_in_days":90}' | jq '.'
```

回應會包含：

* `access_token`
* `expires_at`
* `mcp_url`

### 2. 加到 Codex 設定

編輯 `~/.codex/config.toml`：

```toml
[mcp_servers.zentropy]
enabled = true
url = "https://api.zentropy.cc/mcp?access_token=<你的 PAT>"
```

### 3. 重啟 Codex

Codex 重新啟動後就能直接使用 Zentropy MCP。

## 🔐 啟用 OAuth 認證（選用，適用 Claude Code 等支援 OAuth 的 Client）

如果你想啟用完整的 OAuth 2.1 認證：

### 1. 設定 JWT Secret

```bash
# 生成隨機 secret
openssl rand -base64 32

# 加入到 .env
echo "ZENTROPY_MCP_JWT_SECRET=<生成的secret>" >> api/.env
```

### 2. 重新部署

```bash
cd api
bash scripts/deploy-api.sh
```

### 3. 更新 Claude Code 設定

編輯 `~/.claude/settings.json`，將 `zentropy` server 改為：

```json
{
  "mcpServers": {
    "zentropy": {
      "url": "https://zentropy.cc/mcp",
      "transport": "http",
      "oauth": {
        "discoveryUrl": "https://zentropy.cc/.well-known/oauth-authorization-server-metadata",
        "clientId": "claude-code",
        "scopes": ["read:tasks", "read:knowledge", "write:inbox"],
        "pkce": true
      }
    }
  }
}
```

### 4. 重新授權

重啟 Claude Code，首次使用時會：
1. 開啟瀏覽器到授權頁面
2. 使用 Google 帳號登入
3. 同意授權
4. 自動取得並儲存 token

---

## 📋 可用的 MCP 功能

### Tools（工具）

**v2 推薦使用：**
- **`capture`** - 捕捉想法、執行計畫、結果
- **`report_done`** - 報告任務完成，觸發偏差學習
- **`search`** - 語意搜尋知識庫
- **`save_knowledge`** - 儲存知識到 Reference 區

**Legacy（向後相容）：**
- `capture_thought` - 捕捉想法
- `query_memory` - 查詢記憶
- `append_to_knowledge` - 新增知識

### Resources（資源）

**v2 推薦使用：**
- **`zentropy://handoff/ready`** ⭐ - 準備好執行的意圖交接包
- **`zentropy://context/now`** - Coach 全局狀態感知
- **`zentropy://memory/bias`** - 個人估時偏差數據
- **`zentropy://areas`** - 用戶領域結構

**Legacy（向後相容）：**
- `zentropy://knowledge/{area}/{product}/{topic}` - 知識資產
- `zentropy://saga/{product_id}` - Rolling Saga
- `zentropy://profile/bias-vector` - 用戶偏好

### Prompts（提示詞模板）

- **`summarize-for-zentropy`** - 整理成 Zentropy Rolling Summary 格式
- **`generate-spec-structure`** - 生成 Zentropy Specification 結構

---

## 🧪 測試場景

### 場景 1：捕捉想法
```
使用 Zentropy MCP 的 capture tool，內容：「研究如何優化 MCP Server 的回應速度」
```

### 場景 2：讀取待辦任務
```
讀取 zentropy://handoff/ready resource，告訴我有哪些準備好執行的任務
```

### 場景 3：全局狀態感知
```
讀取 zentropy://context/now，分析當前有哪些 open loops 或衝突
```

### 場景 4：語意搜尋
```
使用 Zentropy MCP 的 search tool，搜尋「MCP 安全架構」相關的知識
```

### 場景 5：查看估時偏差
```
讀取 zentropy://memory/bias，告訴我過去的估時準確度
```

---

## 🔧 除錯

### 檢查 MCP Server 是否正確新增

```bash
# 查看設定
cat ~/.claude/settings.json | jq '.mcpServers'

# 或使用 Claude Code CLI
claude mcp list
```

### 查看日誌

如果遇到問題，查看 Cloud Run 日誌：

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=zentropy-api" \
  --project=zentropy-4f7a5 \
  --limit=20 \
  --format=json \
  | jq '.[] | select(.jsonPayload.mcp) | {timestamp, message: .jsonPayload}'
```

### 手動測試 MCP Endpoint

```bash
# 測試 health
curl -s https://zentropy.cc/health

# 測試 OAuth discovery
curl -s https://zentropy.cc/.well-known/oauth-authorization-server-metadata | jq '.'
```

---

## 📚 相關文件

- **完整測試指南**: `MCP_TESTING_GUIDE.md`
- **OAuth 設定腳本**: `claude-mcp-oauth-setup.sh`
- **MCP Server 規格**: `docs/01_Specification/010_MCP_Server_Spec.md`
- **MCP Functions 設計**: `docs/02_Plan/004_MCP_Functions_Design.md`

---

最後更新：2026-02-17
