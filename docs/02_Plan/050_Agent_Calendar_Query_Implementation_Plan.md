# Agent Calendar Query Implementation Plan

**版本**: v1.0
**更新日期**: 2026-03-11
**對應 Spec**: [`018_Agent_Calendar_Query_Spec.md`](../01_Specification/018_Agent_Calendar_Query_Spec.md)

## 1. 實作切片

本輪只落地最小可用 calendar query slice：

1. `calendar_query` intent
2. `query_calendar` tool / skill
3. ToolFirstAgent direct route
4. 典型 query 測試 + baseline 驗證

## 2. 實作策略

### 2.1 Decision Layer

- deterministic fast-path 接住明確的會議 / 行程 / 空檔查詢
- `AgentIntentSchema` 與 `DECISION_PROMPT` 同步加入 `calendar_query`

### 2.2 Executor Layer

- 新增 `AgentCalendarQueryService`
- 內部根據原句解析：
  - query kind: `events | availability`
  - day offset: `0 | 1`
  - part of day: `morning | afternoon | evening | full_day`

### 2.3 Data Source

- events: 直接查 Google Calendar API events.list
- availability: 重用既有 `CalendarService.queryFreeBusy`

## 3. 驗證計畫

Targeted:

- `agent-intent-resolver.test.ts`
- `query-calendar-skill.test.ts`
- `tool-first-agent.test.ts`

Regression:

- `npm run lint`
- `npm run test:unit -- agent-related targeted subset`
- `npm run test:agent:baseline`
- `npm run test:remote`

若 live / remote 測試受外部依賴限制失敗，必須記錄是哪個依賴阻塞。
