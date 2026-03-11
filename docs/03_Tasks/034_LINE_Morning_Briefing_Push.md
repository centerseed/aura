# Task 034: LINE 晨報推播 Cron

**Status**: In Progress  
**Owner**: Codex
**Dependencies**:
- [`docs/01_Specification/017_LINE_Morning_Briefing_Push_Spec.md`](../01_Specification/017_LINE_Morning_Briefing_Push_Spec.md)
- [`docs/02_Plan/049_LINE_Morning_Briefing_Push_Implementation_Plan.md`](../02_Plan/049_LINE_Morning_Briefing_Push_Implementation_Plan.md)

## 1. 目標

讓已綁定 LINE 的使用者，在晨報預設開始時間收到一則包含晨報摘要與今日任務的主動推播，並保證同日只推一次。

## 2. 原子任務

### T034-1: 建立 delivery persistence
- [ ] 在 Prisma schema 新增 `line_message_deliveries`
- [ ] 新增 migration
- [ ] 新增 domain interface 與 Prisma repository
- [ ] 以唯一鍵保證同 user/date/type 不重複

### T034-2: 擴充 LINE formatter
- [ ] 在 `api/src/lib/line-client.ts` 新增晨報推播 formatter
- [ ] 支援 briefing summary + 第一條建議 + today plan items
- [ ] 加入長度截斷保護

### T034-3: 重寫 morning briefing cron route
- [ ] 統一 cron secret 驗證
- [ ] 讀取已綁定使用者與晨報設定
- [ ] 以台灣時間 05:00-11:00 的當前小時命中 `windowStart`
- [ ] 先查 delivery 再決定是否處理
- [ ] 可 reuse 既有 briefing，必要時才生成
- [ ] 讀取當日 plan 並推播 LINE
- [ ] 成功/失敗皆寫 delivery 結果
- [ ] 回傳 `eligible / skipped / sent / failed / reusedBriefing / generatedBriefing`

### T034-4: 補測試
- [ ] formatter unit tests
- [ ] delivery repository tests
- [ ] cron route tests：skip / reuse / generate / failure

### T034-5: 驗證
- [ ] `cd api && npm run lint`
- [ ] `cd api && npm run test`
- [ ] `cd api && npm run build`
