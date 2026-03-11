# Planner Default Placement and Sequencing Plan

## Problem

`run_planner` 在未提供 `product_id` 時，會自動建立實體 `一般` Area 與 `未分類` Product，造成：

- AI 在沒有使用者明確授權下擴張 taxonomy
- Dashboard 出現突兀的新 Area / Product
- 回覆文案與 UI 顯示 `未分類`，體驗粗糙

另外，planner 目前把每個 task 的 `estimated_days` 當成「從今天起算」，導致多個 task 的 `due_date` 彼此不保序，無法反映規劃順序。

## Decision

### 1. Planner 不得自動建立實體 Area / Product

- 若 `product_id` 已指定：照指定 Product 建立任務。
- 若 `product_id` 未指定：planner 必須先根據用戶既有的 Area / Product 結構做吸附判斷。
- planner 只能重用既有 Product；不得自動建立新的 Area 或 Product。
- 若 AI 判斷失敗，fallback 也只能選擇既有 Product，不能寫入 productless task。

### 2. 預設顯示名稱規則

- planner 若最終落到既有的 generic 容器（例如 `未分類` / `一般`），前端顯示名稱應正規化為較可讀的文案。
- 不得使用 `Unknown` 作為 planner 預設顯示名稱。

### 3. Due date 必須依任務順序累加

- `estimated_days` 視為該任務的預估工期，不是從今天起算的絕對 offset。
- planner 建立 task 時，必須依任務順序累加 estimated duration，確保後面任務的 `due_date` 不早於前面任務。
- 若某 task 缺少 `estimated_days`，預設以 1 天處理，避免 due date 停滯或倒退。
- 若外部傳入整體 `due_date`，仍保留該日期作為每個 task 的明確 override。

## Implementation Scope

- `api/src/application/use-cases/agent/planner-skill.ts`
- `api/src/application/use-cases/library/get-library.ts`
- `api/src/app/api/tasks/route.ts`
- `web/lib/api-format-helpers.ts`
- planner / repository / API related tests
