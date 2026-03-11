# LINE 晨報推播規格

**狀態**: Draft  
**日期**: 2026-03-11

## 1. 目標

讓已綁定 LINE 的使用者在晨報預設開始時間收到一則主動推播，內容同時包含：

- 當日晨報摘要
- 一個最重要的晨間建議
- 今日預計任務摘要

這個能力要建立在現有 `GenerateBriefingUseCase` 與 `daily_plans` 之上，不新增第二套晨報/今日計畫生成邏輯。

## 2. 使用者價值

- 使用者不需要先打開 App，也能在早上收到「今天要看什麼、先做什麼」
- 晨報從被動查看變成主動送達
- LINE bot 從「對話入口」延伸為「晨間主動教練」

## 3. 功能行為

### 3.1 觸發條件

- 僅限已綁定 LINE 的使用者
- 使用者晨報提醒必須為啟用狀態；若未設定，使用系統預設晨報窗口
- 外部 Cloud Scheduler 在台灣時間 `05:00` 到 `11:00` 每小時觸發一次
- 每次 cron 執行時，以台灣時區當前小時比對使用者 `briefingSchedule.morning.windowStart`
- 僅當 `currentHour === windowStart` 時才進入推播流程

### 3.2 晨報與計畫來源

- 若該使用者在當地日期尚未有 MORNING briefing，cron 必須生成晨報
- 若該使用者當天已有 MORNING briefing，cron 必須重用既有 briefing，不得因 briefing 已存在就跳過推播
- 晨報生成後，系統讀取同一天 `daily_plan`
- 推播中的今日任務僅使用 `daily_plan.items` 中 `status === 'today'` 的項目

### 3.3 推播內容

- 單則純文字 LINE 訊息
- 結構固定：
  - 日期與早安開場
  - 晨報 summary
  - 第一條 recommendation
  - 今日任務列表
- 若今日任務為空，必須明確顯示「今天沒有排定任務」
- 訊息必須受 LINE 單則 5000 字限制保護

### 3.4 去重與補推

- 同一使用者、同一日期、同一 delivery type 僅可視為一次成功推播
- 若使用者已手動生成晨報，但尚未有 LINE delivery 成功紀錄，cron 仍需補推
- 若當日已存在成功 delivery，cron 必須直接略過，不得重複推播

### 3.5 失敗處理

- 單一使用者推播失敗不得中斷其他使用者
- 每次失敗必須留下 delivery 紀錄與錯誤訊息
- 本版不做同次 execution 內重試

## 4. 非目標

- 不支援分鐘級晨報開始時間
- 不支援 Flex Message / Rich Menu / 圖文卡片
- 不支援全球時區晨報視窗覆蓋；本版以台灣與泛華語 UTC+8 市場為主
- 不在本版處理晚報 LINE 推播

## 5. 成功標準

- 命中開始小時的使用者會收到一則晨報 LINE 推播
- 同一天不會收到重複晨報推播
- 手動先生成晨報後，cron 仍可補發 LINE 推播
- route 失敗具有可查 delivery 與 log 紀錄
