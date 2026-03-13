# Spec: recurring-task-duplicate

## Goal
修復 DAILY 週期化任務每天產生 2 張卡片的 bug，改為每天只產生 1 張（當天到期的）。

## Metadata
- affected: [api]
- db_migration: true
- deploy_required: true

## Context
- **Root Cause**: `lead_days` 預設值為 1，導致 `generateThreshold = today + 1`，`<=` 判斷讓窗口包含今天和明天兩天。DAILY task 每天都會產生 2 張卡（today + tomorrow）。
- **Affected files**: Prisma schema（default 值）、generation use case（無需改 runtime 邏輯）、existing DB records
- **Architecture layer**: infrastructure（schema）+ data migration
- **Dependencies**: `generate-recurring-task-instances.ts` 的 `generateThreshold` 計算不需修改，只要 `lead_days = 0` 就自然只建當天的 task

## Acceptance Criteria (BDD)

### AC1: lead_days 預設值改為 0
- **GIVEN** Prisma schema 中 `RecurringTask.lead_days` 預設為 1
- **WHEN** 修改 schema 將預設值改為 0
- **THEN** 新建的 recurring task 預設 `lead_days = 0`
- **Test**: unit
- **Platform**: api

### AC2: 現有 recurring tasks 的 lead_days 更新為 0
- **GIVEN** 資料庫中所有 recurring tasks 的 `lead_days = 1`（因為 UI 從未提供設定）
- **WHEN** 執行 migration
- **THEN** 所有 existing records 的 `lead_days` 被更新為 0
- **Test**: integration
- **Platform**: api

### AC3: DAILY task 每天只產生 1 張卡
- **GIVEN** 一個 DAILY recurring task（interval=1, lead_days=0）
- **WHEN** generate 被呼叫（localDate = today）
- **THEN** 只建立 `due_date = today` 的 task，不建立 `due_date = tomorrow` 的 task
- **Test**: unit
- **Platform**: api

### AC4: generate 被多次呼叫不會產生重複
- **GIVEN** 一個 DAILY recurring task（lead_days=0），generate 已被呼叫一次（建立了今天的 task）
- **WHEN** generate 再次被呼叫（同一天）
- **THEN** 不會建立第二張 task（dedup 機制正常運作），`generated = 0, skipped = 1`
- **Test**: unit
- **Platform**: api

### AC5: 隔天只產生新的一張卡
- **GIVEN** 一個 DAILY recurring task（lead_days=0），昨天已建立昨天的 task
- **WHEN** generate 被呼叫（localDate = tomorrow）
- **THEN** 只建立 `due_date = tomorrow` 的 task（1 張），不建立 `due_date = day_after_tomorrow`
- **Test**: unit
- **Platform**: api

### AC6: WEEKLY task 不受影響
- **GIVEN** 一個 WEEKLY recurring task（lead_days=0, daysOfWeek=[1]）
- **WHEN** generate 被呼叫（localDate = 該週一）
- **THEN** 建立 `due_date = 該週一` 的 task
- **Test**: unit
- **Platform**: api

## Test Strategy
| AC | Type | Location | Platform |
|----|------|----------|----------|
| AC1 | unit | api/tests/unit/use-cases/recurring/ | api |
| AC2 | integration | SQL migration verification | api |
| AC3 | unit | api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts | api |
| AC4 | unit | api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts | api |
| AC5 | unit | api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts | api |
| AC6 | unit | api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts | api |

## Out of Scope
- UI 新增 lead_days 設定功能（未來再做）
- 改變 `generate-recurring-task-instances.ts` 的 runtime 比較邏輯（不需要改，lead_days=0 自然修正）
- 改變 lookAhead（3 天）或 cutoff（today-1）邏輯
- Flutter / Web 端的任何改動

## Files Expected to Change
- `api/prisma/schema.prisma` — `lead_days` default 從 1 改為 0
- `api/prisma/migrations/<timestamp>_recurring_task_lead_days_zero/migration.sql` — ALTER DEFAULT + UPDATE existing records
- `api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts` — 新增/修改 AC3-AC6 測試

## Files That Must NOT Change
- `api/src/application/use-cases/recurring/generate-recurring-task-instances.ts` — runtime 邏輯不需改
- `api/src/application/use-cases/recurring/recurrence-utils.ts` — 計算邏輯不需改
- `app/` — Flutter 端不需改動
- `web/` — Web 端不需改動

## PAUSE Gates
- [x] DB migration: YES — 修改 lead_days default 並 UPDATE 現有 records
- [ ] Test data deletion: no
- [x] Deployment: YES — api service（migration 需要先跑）
