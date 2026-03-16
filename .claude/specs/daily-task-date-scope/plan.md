# Plan Brief: daily-task-date-scope

## Goal
為任務引入 `date_locked` 欄位，讓 Brain Dump 自動辨識「事件型」任務（occurrence）並標記，使其不提前列入每日代辦清單——只在到期日當天出現。

## BDD Spec
→ 行為合約：`docs/bdd/daily-task-date-scope.feature`
  Scenarios in scope: @ac1, @ac2, @ac3, @ac4, @ac5

## Metadata
- affected: api, app（Flutter）
- db_migration: true
- deploy_required: true（API + App）

---

## 核心設計決策

### date_locked 的語意
- `date_locked = false`（預設）：due_date 是「截止點」，可提前列入代辦
- `date_locked = true`：due_date 是「發生點」，只有 `due_date == today` 才列入代辦

### 判斷主路徑：Brain Dump LLM 自動偵測
不依賴用戶手動標記。Brain Dump 的 `generateObject` 已有 LLM 語意分析，
直接在 `StructuredItemSchema` 加入 `date_locked: boolean` 欄位，
並在 prompt 中描述 occurrence vs deadline 的判斷標準。
用戶手動 override 為次要（@ac4）。

### 判斷信號（寫入 prompt）
```
判斷是否為當日限定（date_locked: true）：
- 動詞暗示「出席/前往/到場」：去、參加、出席、看、觀看、體驗、赴約、接送
- 受詞是外部固定事件：展覽、婚禮、活動、演出、會議（行事曆型）、比賽、儀式
- 用戶不能提前執行該任務——事件在那天才存在

date_locked = false 的情況：
- 動詞暗示「產出/完成」：寫、做、準備、完成、整理、提交
- 受詞是用戶自己產出的東西
- 可以提前完成
```

---

## AC → Test Mapping

| AC Tag | Scenario | Test Type | Test File | Platform |
|--------|----------|-----------|-----------|----------|
| @ac1 | date_locked 任務在到期日前不列入計畫 | unit | `api/src/tests/unit/services/unified-data-transformer.test.ts` | api |
| @ac2 | date_locked 任務在到期日當天列入 | unit | `api/src/tests/unit/services/unified-data-transformer.test.ts` | api |
| @ac3 | Brain Dump 自動判斷 occurrence 型任務 | unit | `api/src/tests/unit/brain-dump/generate-brain-dump-structure.test.ts` | api |
| @ac4 | 用戶手動切換 date_locked | widget | `app/test/features/task_edit/date_locked_toggle_test.dart` | app |
| @ac5 | 現有任務預設行為不變 | unit | `api/src/tests/unit/services/unified-data-transformer.test.ts` | api |

---

## Files to Change

### 1. DB Schema & Migration
- `api/prisma/schema.prisma`
  - Task model 加入：`date_locked Boolean @default(false)`
- 執行：`npx prisma migrate dev --name add-date-locked-to-tasks`
- 執行：`npx prisma generate`

### 2. Brain Dump — 自動偵測（@ac3 主路徑）
- `api/src/application/use-cases/brain-dump/generate-brain-dump-structure.ts`
  - `StructuredItemSchema`（約 L40）加入：
    ```ts
    date_locked: z.boolean().default(false).describe(
      "true = 事件型任務（去看展/參加婚禮），due_date 是發生點，只在當天執行；false = 截止型任務，可提前完成"
    )
    ```
  - Prompt 中加入 occurrence vs deadline 判斷指引（見上方「判斷信號」）
  - Brain Dump 儲存路徑同步將 `date_locked` 寫入 DB

### 3. 每日計畫篩選 — 核心過濾（@ac1, @ac2）
- `api/src/infrastructure/services/unified-data-transformer.ts`
  - `candidateTasks` filter（約 L91-110）加入：
    ```ts
    // date_locked 任務：只有 due_date 在今天範圍內才列入
    if (task.date_locked && task.due_date) {
      return task.due_date >= todayStart && task.due_date < todayEnd
    }
    ```
  - 此條件在現有 4 個 filter 條件之前插入（short-circuit）

### 4. RawTask 型別補充
- `api/src/infrastructure/services/unified-data-collector.ts`
  - RawTask interface 加入 `date_locked: boolean`
  - DB query select 補上 `date_locked` 欄位

### 5. Task CRUD API — 暴露欄位（@ac4）
- `api/src/app/api/tasks/[id]/route.ts`（PUT handler）
  - 接受並儲存 `date_locked: boolean`
- `api/src/app/api/tasks/route.ts`（GET 回傳）
  - 回傳 `date_locked` 欄位

### 6. Flutter App — UI Toggle（@ac4）
- `app/lib/domain/entities/task.dart`（或現有 Task entity）
  - 加入 `dateLocked: bool`
- `app/lib/data/repositories/task_repository.dart`（或同層）
  - JSON mapping 補 `date_locked`
- `app/lib/presentation/screens/task_edit/`（任務編輯畫面）
  - 加入「當日限定」SwitchListTile
  - 僅在 `due_date != null` 時顯示

---

## Files That Must NOT Change
- `api/src/application/use-cases/coach/generate-plan.ts` — AI 排序邏輯不動，過濾在 transformer 層處理
- `api/prisma/migrations/` 已有的 migration 檔案 — 只新增不修改

---

## Out of Scope
- 晨報（briefing）中的 `approachingTasks` / `overdueTasks` 顯示邏輯（date_locked 不影響）
- 子任務（SubTask）的 date_locked（本次只做頂層 Task）
- Web 端 UI toggle（Flutter 先行，Web 後續）
- 已有任務的 batch migration（預設 false，無需回填）

---

## Implementation Order
1. Prisma schema + migrate + generate
2. RawTask 型別 + collector query
3. unified-data-transformer 過濾邏輯 + 單元測試
4. Brain Dump schema + prompt 更新 + 單元測試
5. Task API PUT/GET 補欄位
6. Flutter entity + repository mapping + UI toggle

---

## PAUSE Gates
- [x] DB migration: YES — 新增 `date_locked Boolean @default(false)`，向後相容，不需要資料回填
- [ ] Test data deletion: NO
- [ ] Deployment: YES — API 先部署（migration），App 後更新
