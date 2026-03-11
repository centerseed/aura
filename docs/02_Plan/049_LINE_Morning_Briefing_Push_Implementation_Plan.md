# LINE 晨報推播技術計畫

**狀態**: Approved for implementation  
**日期**: 2026-03-11

## 1. Summary

在既有 LINE 綁定、晨報生成與每日計畫能力上，新增「晨報 delivery tracking + 晨報 LINE cron push」。實作採最小擴充：

- 重用現有 `GenerateBriefingUseCase`
- 重用現有 `GetPlanUseCase` / `DailyPlanRepository`
- 以新的 delivery repository 管理去重與發送結果
- 以現有 `api/src/app/api/line/cron/morning-briefing/route.ts` 作為唯一 cron 入口

## 2. 決策

### 2.1 時間語意

- 以台灣時區 `Asia/Taipei` 為 cron 判定基準
- 外部 Cloud Scheduler 僅在 `05:00-11:00` 每小時觸發一次
- 使用者晨報開始時間直接取 `settings.briefingSchedule.morning.windowStart`
- 若使用者未設定，預設開始時間為 `07:00`

### 2.2 去重資料模型

新增 `line_message_deliveries` 表，保存：

- `user_id`
- `channel`
- `delivery_type`
- `delivery_date`
- `briefing_id`
- `daily_plan_id`
- `line_user_id`
- `status`
- `error_message`
- `sent_at`

約束：

- 唯一鍵：`(user_id, channel, delivery_type, delivery_date)`
- 同一日期最多一筆 delivery logical record
- 失敗先寫 `failed`，後續成功可透過 upsert 覆寫為 `sent`

### 2.3 Cron 執行流程

1. 驗證 cron secret
2. 取台灣時區當前日期與小時
3. 查詢所有已綁定 LINE、未刪除的使用者
4. 逐一解析晨報 enabled 與 `windowStart`
5. 當 `currentHour !== windowStart` 時 skip
6. 查 delivery 表，若當日已 `sent` 則 skip
7. 查當日 MORNING briefing
8. 若不存在則呼叫 `GenerateBriefingUseCase`
9. 讀取同日 `daily_plan`
10. 格式化單則 LINE 文字
11. `pushMessage`
12. upsert delivery 為 `sent` 或 `failed`
13. 回傳聚合統計並輸出失敗 log

### 2.4 訊息格式

formatter 新增專用函式，規則：

- 標題行顯示早安與日期
- summary 全文保留
- recommendation 只取第一條
- `today` 任務依 order 顯示前 5 項
- 任務行可附 estimated minutes
- 若長度過長，優先保留：
  - 標題
  - summary
  - 第一條 recommendation
  - 前幾項 today 任務

## 3. 介面變更

- 新增 domain interface：LINE delivery repository
- 新增 infrastructure repository：PrismaLineMessageDeliveryRepository
- `line-client` 新增 `formatMorningBriefingPush(briefing, plan)`
- `line/cron/morning-briefing` route 改為透過 repository 做去重與紀錄

## 4. 測試策略

- formatter unit tests
- delivery repository unit/integration-style tests
- cron route unit tests：
  - 開始小時未命中
  - disabled
  - 已 sent skip
  - reuse existing briefing
  - generate new briefing
  - push failure 記 failed 且不中斷

## 5. 驗證

- `cd api && npm run lint`
- `cd api && npm run test`
- `cd api && npm run build`

若 migration 需要額外生成 client，納入 build/test 前置流程。
