# Agent Calendar Query Specification

**版本**: v1.0
**更新日期**: 2026-03-11
**定位**: 擴充 LINE Agent，使其可回應日曆查詢需求，而不再把所有非任務需求都退回成能力外訊息。

## 1. 問題定義

目前 LINE Agent 的能力邊界被限制在任務操作。當使用者詢問：

- `我明天有什麼會議？`
- `今天有什麼行程？`
- `明天下午有空嗎？`

即使系統內已有 Google Calendar 與 briefing 能力，agent 仍會回覆「目前只能處理任務相關功能」。

這個失敗是因為 **agent 缺少 calendar query intent 與對應 execution path**，不是因為模型本身不夠聰明；要改的單一位置是 **agent 的 decision / executor control plane**。

## 2. 產品目標

1. Agent 能理解常見的會議 / 行程 / 空檔查詢。
2. 查詢結果必須來自真實資料來源，而不是模型臆測。
3. 若 Google Calendar 尚未連接，agent 必須明說缺少授權，而不是回 generic fallback。

## 3. 第一批支援範圍

本輪只支援 query，不支援 mutation。

### 3.1 支援句型

- `我今天有什麼會議？`
- `我明天有什麼會議？`
- `今天有什麼行程？`
- `明天有什麼行程？`
- `今天有空嗎？`
- `明天下午有空嗎？`
- `今天上午有沒有空檔？`

### 3.2 支援能力

- 查詢指定日期的 calendar events
- 查詢指定日期 / 時段的 availability（free/busy）

### 3.3 非目標

- 不在本輪支援建立 / 修改 / 刪除會議
- 不在本輪支援跨週、多天複雜推理
- 不在本輪支援日曆與任務的混合規劃回答

## 4. Canonical Intent

新增：

- `calendar_query`

意義：

- 只表示「使用者在查詢日曆資訊」
- 具體查 events 還是 availability，由 executor/tool 依原句進一步解析

## 5. Execution 規則

### FR-1 Calendar query 必須先決定資料類型

- 問「有什麼會議 / 行程」→ events
- 問「有空嗎 / 空檔」→ availability

### FR-2 Calendar query 必須解析時間範圍

本輪至少支援：

- 今天
- 明天
- 上午 / 下午 / 晚上

若未明說日期，預設為今天。

### FR-3 回覆只能根據工具結果

- events query 只能根據 calendar query tool 回傳的事件清單回答
- availability query 只能根據 free/busy tool 回傳的空檔回答
- 不得自行補會議標題、數量或空檔

### FR-4 未連接 Calendar 時要明說

若底層資料來源回傳 `Google Calendar not connected`，回覆必須直接告知：

- 尚未連接 Google Calendar
- 目前無法查詢會議 / 空檔

不得退回 generic unknown/fallback 文案。

## 6. Response 準則

- 先講重點，再列清單
- 沒有資料時直接說查不到會議或空檔
- availability 只列出前幾個可用時段，避免 LINE 訊息過長

## 7. 驗證

至少覆蓋：

1. intent resolver 能把典型會議 / 空檔問句路由到 `calendar_query`
2. ToolFirstAgent 可 direct route 到 calendar query tool
3. 既有 agent baseline / remote tests 無嚴重回歸
