# Zentropy MCP Server 測試指南

## ✅ 雲端 MCP Server 狀態

**URL**: `https://zentropy-api-894512935237.asia-east1.run.app/mcp`
**Health Check**: `https://zentropy-api-894512935237.asia-east1.run.app/health`

```bash
curl -s https://zentropy-api-894512935237.asia-east1.run.app/health | jq '.'
# 回應：{"status":"ok","service":"zentropy-api","mcp":true,"activeSessions":0}
```

---

## 📋 方案 A：在這個 Claude Code 對話中直接測試（最簡單）

由於你現在就在 Claude Code 中，我們可以直接在這裡測試 MCP！

### 步驟：

1. **設定 MCP Server 連線**

   開啟 `~/.claude/settings.json`，新增以下內容：

   ```bash
   open ~/.claude/settings.json
   ```

   在檔案中新增（如果已有 `mcpServers` 則合併）：

   ```json
   {
     "mcpServers": {
       "zentropy": {
         "url": "https://zentropy-api-894512935237.asia-east1.run.app/mcp",
         "transport": "http"
       }
     },
     ... 其他現有設定 ...
   }
   ```

2. **重新啟動 Claude Code**

   ```bash
   # 方式 1：關閉當前對話，重新開啟一個新的對話
   # 方式 2：或執行（如果支援）
   claude restart
   ```

3. **測試 MCP Tools**

   在新的對話中，直接要求 Claude 使用 MCP tools：

   ```
   User: 使用 Zentropy MCP 的 capture tool，捕捉這個想法：「測試 MCP 整合」
   ```

   或者：

   ```
   User: 讀取 zentropy://handoff/ready resource，看看有哪些待執行的任務
   ```

---

## 📋 方案 B：使用 MCP Inspector（視覺化測試）

MCP Inspector 是官方的 GUI 測試工具。

### 安裝：

```bash
npm install -g @modelcontextprotocol/inspector
```

### 啟動：

```bash
npx @modelcontextprotocol/inspector
```

然後在開啟的 Web UI 中：
1. 輸入 Server URL: `https://zentropy-api-894512935237.asia-east1.run.app/mcp`
2. Transport: 選擇 `HTTP`
3. 點擊 Connect

你會看到：
- 所有可用的 Tools（capture, report_done, search, save_knowledge 等）
- 所有可用的 Resources（handoff-ready, context-now, memory-bias 等）
- 可以直接在 UI 中測試呼叫

---

## 📋 方案 C：命令列快速測試

如果只是想快速驗證功能，可以用以下命令：

### 1. 確認 Server 運行中

```bash
curl -s https://zentropy-api-894512935237.asia-east1.run.app/health | jq
```

### 2. 查看 MCP Endpoint

```bash
curl -s https://zentropy-api-894512935237.asia-east1.run.app/mcp \
  -H "Accept: text/event-stream" \
  | head -20
```

---

## 🔧 可用的 MCP Tools

根據 `src/mcp/server.ts`，以下 tools 已部署：

### v2 Tools（推薦使用）
- **capture** - 統一入口，捕捉想法/執行計畫/結果
- **report_done** - 報告任務完成，觸發偏差學習
- **search** - 語意搜尋（取代 query_memory）
- **save_knowledge** - 寫入知識庫（取代 append_to_knowledge）

### Legacy Tools（向後相容）
- **capture_thought** - 捕捉想法
- **append_to_knowledge** - 寫入知識庫
- **query_memory** - 查詢記憶

---

## 🗂️ 可用的 MCP Resources

### v2 Resources（推薦使用）
- **zentropy://handoff/ready** ⭐ - 準備好執行的意圖交接包
- **zentropy://context/now** - Coach 生成的全局狀態
- **zentropy://memory/bias** - 個人估時偏差數據
- **zentropy://areas** - 用戶領域結構

### Legacy Resources（向後相容）
- **zentropy://knowledge/{area}/{product}/{topic}** - 知識資產
- **zentropy://saga/{product_id}** - Rolling Saga
- **zentropy://profile/bias-vector** - 用戶偏好

---

## 🎯 核心測試場景

### 場景 1：捕捉想法
```
User: 使用 Zentropy MCP 的 capture tool，內容是：「研究 MCP 安全架構的防禦機制」
```

預期結果：
- Tool 被成功呼叫
- 返回 task_id
- 想法被存入 Zentropy Inbox

### 場景 2：讀取待執行任務
```
User: 讀取 zentropy://handoff/ready，告訴我有哪些準備好執行的任務
```

預期結果：
- Resource 被成功讀取
- 返回 handoff packages（包含 context, why, acceptance_criteria）

### 場景 3：語意搜尋
```
User: 使用 Zentropy MCP 的 search tool，搜尋「MCP 安全威脅」
```

預期結果：
- Tool 被成功呼叫
- 返回相關的知識或決策

---

## 🚨 認證模式

目前雲端 MCP Server 運行在 **開發模式**：
- 不需要 JWT token
- 自動使用 `dev-user` context
- 擁有所有權限（read:tasks, write:inbox 等）

這是因為 `.env` 中沒有設定 `ZENTROPY_MCP_JWT_SECRET`。

**生產環境需要**：
1. 設定 `ZENTROPY_MCP_JWT_SECRET`
2. 實作完整的 OAuth 2.1 + PKCE 流程
3. 使用 `scripts/deploy-api.sh` 部署時帶上 secret

---

## 📊 除錯與監控

### 查看 Cloud Run 日誌
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=zentropy-api" \
  --project=zentropy-4f7a5 \
  --limit=50 \
  --format=json
```

### 查看 MCP Audit Log
MCP Server 的 Audit Logger 會記錄所有操作到 Cloud Logging。

---

## ✅ 完成檢查清單

測試 MCP Server 時，確認以下功能：

- [ ] Health Check 返回 `"mcp": true`
- [ ] 能夠列出所有 Tools
- [ ] 能夠列出所有 Resources
- [ ] `capture` tool 能夠成功捕捉想法
- [ ] `zentropy://handoff/ready` resource 能夠被讀取
- [ ] `search` tool 能夠執行語意搜尋
- [ ] 所有操作都被記錄到 Audit Log

---

## 🎉 下一步

完成測試後，可以：

1. **整合到工作流程**：在 Cursor、Claude Code、Claude Desktop 中使用
2. **擴充 Tools**：根據需求新增更多 MCP tools
3. **啟用 OAuth**：實作生產級認證
4. **監控與優化**：追蹤使用率、回應時間、錯誤率

---

最後更新：2026-02-17
