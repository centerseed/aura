# Agent Session Lifecycle Idle Flush Plan

**版本**: v1.0
**更新日期**: 2026-03-10
**對應 Spec**: [`003_System_Infrastructure_Spec.md`](../01_Specification/003_System_Infrastructure_Spec.md)
**目標**: 為 Zentropy agent 建立可控的 session lifecycle，讓長期記憶寫入不再綁死每輪自動執行，而是可由 `LONG_TERM_MEMORY_MODE` 控制，並支援 `idle_flush_30m` 的切段與 reset 行為。

## 1. 問題定義

目前 agent 的短期對話記憶、context summary、以及長期記憶寫入分散在 `naru-agent-js` 的既有能力中：

1. session history 由 `sessionStore` 管理
2. context compression summary 由 `summaryStore` 管理
3. long-term memory 在 `memoryManager` 中每輪背景自動寫入

這造成三個問題：

1. 無法用產品語義控制何時 flush 長期記憶
2. 無法在 idle timeout 時切段並 reset 對話上下文
3. timeout 判斷依賴 agent 內部行為，沒有獨立 metadata layer

## 2. 技術目標

本次變更要達成：

1. 定義 `LONG_TERM_MEMORY_MODE`
2. 新增 application layer 的 `AgentSessionLifecycleService`
3. 將 idle timeout 判斷從 LLM orchestration 中抽離
4. 將 long-term memory 寫入改為 lifecycle 可控觸發
5. 為 flush/reset 建立冪等與併發保護
6. 把新測試納入 API 驗證與 agent gate 流程

## 3. Target Flow

```text
Incoming Message
  -> AgentSessionLifecycleService.beforeMessage(sessionId, userId, now)
  -> if idle segment:
       flush previous segment to long-term memory
       clear session history
       clear compressed summary
  -> NaruAgent.chat(current message)
  -> AgentSessionLifecycleService.afterMessage(sessionId, now)
```

## 4. Design Decisions

### 4.1 Long-Term Memory Modes

- `off`: 不建立 agent long-term memory read/write 路徑
- `each_turn`: 保留既有 `memoryManager` 每輪寫入
- `idle_flush_30m`: `memoryManager` 不掛在 `NaruAgent` 本體，而由 lifecycle 顯式 flush 舊 segment

### 4.2 Lifecycle Service Boundary

`AgentSessionLifecycleService` 放在 application layer，負責：

1. `beforeMessage`
2. `afterMessage`
3. `last_activity_at` 讀寫
4. idle timeout 判斷
5. flush snapshot orchestration
6. reset session history + summary
7. flush marker / segment sequence 管理

### 4.3 Dedicated Meta Store

新增 `SessionMetaStore` 介面，初期實作 `InMemoryAgentSessionMetaStore`。

`SessionMeta` 至少包含：

- `lastActivityAt`
- `currentSegmentId`
- `lastFlushedSegmentId`
- `lastFlushAt`

這讓 timeout 與 idempotency 不依賴 LLM framework 自身 store format。

### 4.4 Failure Handling

idle flush 失敗時：

1. 不阻塞本輪回覆
2. 不清除既有短期上下文
3. 記錄 error log

這個決策避免在 long-term memory 未成功落盤時丟失短期上下文。

### 4.5 Concurrency Contract

- 同一 `sessionId` 的 lifecycle transition 使用 process-local keyed mutex
- flush 只針對 `currentSegmentId`
- flush 成功後才寫入 `lastFlushedSegmentId`
- 未來 Redis 化時，mutex 可抽換為 distributed lock

### 4.6 Agent Primary Model Replacement Notes

本次 agent 主模型替換實際驗證出的結論：

1. `baseline pass` 不等於 provider 原生完全相容
2. Groq `meta-llama/llama-4-scout-17b-16e-instruct` 在目前 SDK / tool schema 條件下，不能視為 Gemini 的原生 function-calling 等價替換
3. 為了讓產品行為穩定，本次採用 `tool-first routing`：
   - 對高信心 skill 先由 orchestration 決定是否直接執行工具
   - 將 provider 依賴縮到「自然語言生成」而不是「每一步都依賴模型產生 tool arguments」

目前採用的實務策略：

- 主模型集中在 `api/src/lib/agent-model.ts`
- 高信心 skill 路徑由 `ToolFirstAgent` 先處理
- 問候、回憶、極短澄清、planner 開發中提示等固定型對話，也提供 deterministic fallback

進一步的切換架構要求：

1. Provider 選擇與 routing 策略必須拆開
2. 至少提供兩個 env 開關：
   - `AGENT_PRIMARY_PROVIDER=groq|gemini`
   - `AGENT_ROUTING_MODE=provider_default|tool_first`
3. `agent-model.ts` 負責 provider-specific model construction
4. agent factory 只負責依照 routing mode 組裝 delegate chain，不直接寫死 Groq 或 Gemini 特例
5. 未來若新增第三個 provider，應只需要：
   - 在 model adapter 新增 provider factory
   - 在文件補 provider compatibility note
   - 重跑 baseline / gate

這代表：

- 若未來切回 Gemini，預期不會因為這次重構而壞掉
- 但是否保留 `tool-first routing`，必須由 `AGENT_ROUTING_MODE` 明確決定
- 如果未來想恢復「完全依賴模型 native tool-calling」的舊行為，應切到 `provider_default` 並重跑 baseline，而不是只改 model name

## 5. Implementation Steps

1. 更新 spec 與 plan 文件
2. 建立 `AgentSessionLifecycleService`
3. 建立 `SessionMetaStore` 與 in-memory 實作
4. 抽出 shared agent runtime，集中 session / summary / meta / memory manager
5. 在 agent factory 包一層 lifecycle-aware orchestrator
6. 保持 API route 與 LINE webhook 走同一 agent 入口
7. 新增 deterministic unit / integration tests
8. 將 lifecycle integration test 納入 `agent-baseline-gate.ts`

## 6. Verification

必跑：

1. `cd api && npm run lint`
2. `cd api && npm run test`
3. `cd api && npm run build`
4. `cd api && npm run test:agent:gate`

若環境允許，另檢查真實 LLM 路徑：

1. `cd api && RUN_AGENT_MEMORY_E2E=1 npm run test:agent:memory`

## 7. Rollout

1. staging 先以 `LONG_TERM_MEMORY_MODE=off` 部署程式碼
2. staging 灰度切 `idle_flush_30m`
3. 觀察 token usage、latency、flush failure rate、fallback rate
4. production 確認穩定後，再評估是否將 `idle_flush_30m` 改為預設值
