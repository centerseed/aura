# Review Brief: daily-task-date-scope

## What Was Built
為任務引入 `date_locked` 欄位，讓「事件型」任務（如去看展、參加婚禮）只在到期日當天列入每日代辦清單。Brain Dump 的 LLM 會自動偵測事件型 vs 截止型任務並設定此欄位，用戶也可在任務編輯畫面手動切換。實作橫跨 Prisma schema、API 層（collector → transformer → routes → use cases）和 Flutter App（entity → model → repository → UI）。

## AC Status
- [x] AC1: date_locked 任務在到期日前不列入計畫 — unified-data-transformer 在 filter 最前方加入 date_locked 短路判斷，只有 `due_date >= todayStart && due_date < todayEnd` 才通過
- [x] AC2: date_locked 任務在到期日當天列入 — 同上邏輯，當天正常列入
- [x] AC3: Brain Dump 自動判斷 occurrence 型任務 — StructuredItemSchema 新增 `date_locked` 欄位，prompt 加入 occurrence vs deadline 判斷指引，execute-brain-dump 儲存時寫入 DB
- [x] AC4: 用戶手動切換 date_locked — Flutter task_detail_bottom_sheet 新增「當日限定」Switch toggle（僅在有 due_date 時顯示），API PATCH /tasks/[id] 接受並儲存 `date_locked`
- [x] AC5: 現有任務預設行為不變 — `date_locked` 預設為 false，filter 邏輯只在 `date_locked === true` 時短路，其餘走原有 4 條規則

## Key Decisions
- Decision 1: date_locked 過濾放在 candidateTasks filter 的最前方（index 0），使用 short-circuit return。這確保 date_locked 任務不會被後續的逾期/15天/已開始規則錯誤納入
- Decision 2: date_locked=true 且逾期的任務也不會列入（設計如此 — 事件過了就過了，不像截止型任務需要追趕）
- Decision 3: 手動建立 migration SQL 而非用 `prisma migrate dev`，因為 shadow database 不支援 vector extension

## Changed Files

### API
- `api/prisma/schema.prisma` — Task model 加入 `date_locked Boolean @default(false)`
- `api/prisma/migrations/20260315000000_add_date_locked_to_tasks/migration.sql` — ALTER TABLE 新增欄位
- `api/src/domain/interfaces/task-repository.ts` — TaskData + TaskUpdateData 加入 dateLocked
- `api/src/domain/interfaces/data-collector.ts` — UnifiedRawData allTasks 型別加入 date_locked
- `api/src/infrastructure/repositories/prisma-task-repository.ts` — RawTaskRow + SELECT + rawToDomain + update mapping
- `api/src/infrastructure/services/unified-data-collector.ts` — RawTask interface + TaskRow + SQL query + mapping
- `api/src/infrastructure/services/unified-data-transformer.ts` — candidateTasks filter 核心邏輯（AC1/AC2/AC5）
- `api/src/application/use-cases/brain-dump/generate-brain-dump-structure.ts` — StructuredItemSchema + prompt 判斷指引（AC3）
- `api/src/application/use-cases/brain-dump/execute-brain-dump.ts` — task.create 加入 date_locked（AC3）
- `api/src/application/use-cases/tasks/update-task.ts` — UpdateTaskRequest + updateData + validation（AC4）
- `api/src/application/use-cases/tasks/create-task.ts` — taskData 補 dateLocked: false
- `api/src/application/use-cases/recurring/generate-recurring-task-instances.ts` — create 補 dateLocked: false
- `api/src/app/api/tasks/[taskId]/route.ts` — PATCH body 解構 + useCase 傳入 + 回傳格式（GET + PATCH）
- `api/src/app/api/tasks/route.ts` — GET + PATCH + POST 回傳格式加入 date_locked

### Flutter App
- `app/lib/domain/entities/task.dart` — 加入 dateLocked field + copyWith + props
- `app/lib/data/models/task_model.dart` — Freezed model 加入 @JsonKey date_locked + toEntity mapping
- `app/lib/data/repositories/mixins/task_json_converter.dart` — taskToJson 加入 date_locked
- `app/lib/application/use_cases/update_task_details_use_case.dart` — Params 加入 dateLocked
- `app/lib/domain/repositories/task_repository.dart` — Interface 加入 dateLocked
- `app/lib/data/repositories/unified/task_unified_repository.dart` — 傳遞 dateLocked
- `app/lib/data/repositories/task_repository_impl.dart` — 傳遞 dateLocked
- `app/lib/data/repositories/utils/task_request_builder.dart` — API request body 加入 date_locked
- `app/lib/presentation/screens/home/widgets/task_detail_bottom_sheet.dart` — 「當日限定」Switch toggle UI

### Tests
- `api/tests/unit/services/unified-data-transformer.test.ts` — 5 個新測試（AC1/AC2/AC5 + 2 edge cases）

## Known Risks / Reviewer Focus Areas
- Area 1: Brain Dump prompt 的 occurrence vs deadline 判斷需要實際測試確認 LLM 分類準確度（建議跑 baseline）
- Area 2: date_locked=true 且逾期的事件不會出現在任何地方 — 確認這是期望行為
- Area 3: DB migration 是手動建立的（非 prisma migrate dev），部署時需確認 migration 正確執行

## Verification Commands Run
```bash
npm run lint    # result: PASS (tsc --noEmit, 0 errors)
npm run test    # result: 19 integration tests passed + 1118 unit tests passed (8 skipped)
npm run build   # result: PASS (Next.js build successful)
```
