# Agent Chat Turn Logging Spec

**版本**: v0.1
**更新日期**: 2026-03-12
**目標**: 為 Zentropy agent 建立可持久化的聊天 turn log，讓後續人工 review 與每週評估腳本能根據真實對話判斷 agent 問題。

## 1. Scope

本規格只處理「每輪聊天 turn 的落盤」。

本次包含：

1. API agent 對話 turn logging
2. LINE agent 對話 turn logging
3. 成功 / 失敗 turn 落盤
4. 後續評估所需的核心欄位

本次不包含：

1. 每週評估腳本
2. 自動聚類 / 自動產生修正建議
3. admin UI 查詢頁
4. PII 自動遮罩策略優化

## 2. Functional Requirements

每次 agent 接收到一則訊息後，系統必須記錄一筆 turn：

1. `user_id`
2. `channel` (`API` 或 `LINE`)
3. `session_id`
4. `request_text`
5. `response_text`
6. `tool_calls`
7. `intent`
8. `usage`
9. `timings`
10. `trace`
11. `status` (`SUCCESS` 或 `ERROR`)
12. `error_message`
13. `created_at`

## 3. Logging Boundary

寫入點必須放在 API 與 LINE 共用的 agent 包裝層，而不是各 route 各自寫入，避免：

1. 某一條入口漏記
2. 同一 turn 被重複寫入
3. 後續擴充新入口時忘記補 log

## 4. Success / Error Semantics

### 4.1 SUCCESS

滿足以下條件才記錄為 `SUCCESS`：

1. agent delegate 完成回覆
2. 回覆通過 execution verifier
3. lifecycle `afterMessage` 完成

### 4.2 ERROR

下列情況記錄為 `ERROR`：

1. lifecycle `beforeMessage` throw error
1. delegate chat throw error
2. execution verifier 擋下回覆
3. lifecycle `afterMessage` throw error

`ERROR` turn 仍需保留：

1. 原始 `request_text`
2. 已知的 `response_text`（若有）
3. `error_message`
4. 已知的 `intent` / `usage` / `timings` / `trace`（若 agent result 已經產生）

### 4.3 Best-Effort Enrichment

若 delegate result 缺少標準欄位，logging wrapper 仍必須做 best-effort 補全，避免 turn 落成「只有 request / response，沒有 routing context」：

1. 若 `result.intent` 缺失，先嘗試從 `trace.resolvedIntent` 回填
2. 若仍缺失，允許依照 confirmation / cancel 類已知語句模式寫入 synthetic intent
3. `metadata` 必須標記 enrichment 來源與 error stage，讓後續 review 能區分原始欄位與推導欄位

## 5. Data Model

新增 `agent_chat_turns` 表。

索引至少包含：

1. `user_id, created_at`
2. `channel, created_at`
3. `session_id, created_at`
4. `status, created_at`

## 6. Read Contract

為了讓任何 agent 都能讀取並分析 turn logs，系統必須提供穩定的查詢介面與固定回傳格式。

### 6.1 Query Surfaces

1. HTTP: `GET /api/agent/chat-turns`
2. MCP tool: `list_agent_chat_turns`

兩者都必須共用同一個資料語義與欄位命名。

### 6.2 Supported Filters

1. `channel`
2. `status`
3. `session_id`
4. `from`
5. `to`
6. `limit`
7. `offset`

### 6.3 Response Shape

```json
{
  "total": 2,
  "limit": 20,
  "offset": 0,
  "items": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "channel": "LINE",
      "session_id": "line-user-id",
      "request_text": "幫我看今天要做什麼",
      "response_text": "你今天有 3 件事...",
      "tool_calls": ["query_today_tasks"],
      "status": "SUCCESS",
      "error_message": null,
      "intent_object": "today_focus",
      "intent": { "object": "today_focus", "confidence": 0.98, "requiresConfirmation": false },
      "usage": { "inputTokens": 12, "outputTokens": 30, "totalTokens": 42 },
      "timings": { "intent_resolve_ms": 12, "total_ms": 520 },
      "trace": { "resolver": "deterministic", "selectedTool": "query_today_tasks" },
      "metadata": {
        "verified": true,
        "errorStage": null,
        "intentSource": "result.intent"
      },
      "created_at": "2026-03-12T00:00:00.000Z"
    }
  ]
}
```

### 6.4 Agent Consumption Rules

任何 agent 讀取這份資料時，應遵守：

1. 先看 `status` 區分成功與失敗 turn
2. 先用 `intent_object` 做粗分類，再用 `request_text` / `response_text` 做質性判斷
3. `tool_calls` 為執行證據；不可只看 `response_text` 判斷是否真的操作成功
4. `trace` 是輔助判斷 routing 與 resolver 行為，不應當作唯一真相

## 7. Non-Goals

本次先不處理：

1. 全文搜尋
2. 資料保留期限
3. 雲端 log sink / BigQuery
4. reviewer dashboard

## 8. Verification

必跑：

1. `cd api && npm run lint`
2. `cd api && npm run test`
3. `cd api && npm run build`
