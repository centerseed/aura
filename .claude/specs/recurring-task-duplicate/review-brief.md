# Review Brief: recurring-task-duplicate

## Implementation Approach

The bug was that `lead_days` defaulted to `1`, causing `generateThreshold = today + 1`. The `<=` comparison then included tomorrow's occurrence, so DAILY tasks generated 2 cards (today + tomorrow).

Fix: change the schema default to `0` and migrate all existing records. The runtime logic in `generate-recurring-task-instances.ts` was **not modified** — with `lead_days=0`, `generateThreshold = today + 0 = today`, and tomorrow's occurrence falls outside the window naturally.

## AC Status

- [x] **AC1**: `api/prisma/schema.prisma` — `lead_days @default(1)` changed to `@default(0)`. Prisma client regenerated.
- [x] **AC2**: Migration `20260313000000_recurring_task_lead_days_zero/migration.sql` — `ALTER TABLE recurring_tasks ALTER COLUMN lead_days SET DEFAULT 0` + `UPDATE recurring_tasks SET lead_days = 0 WHERE lead_days = 1`.
- [x] **AC3**: Test "AC3: lead_days=0 時只建立今天的 task，不建立明天的" — template with `nextOccurrenceAt=today, leadDays=0` produces 1 task with `dueDate=today`. Second test confirms `nextOccurrenceAt=tomorrow` with `localDate=today` produces 0 tasks (threshold not exceeded, no silent skip either).
- [x] **AC4**: Test "AC4: lead_days=0 時重複呼叫不建立第二張 task" — when `mockQueryRaw` returns an existing task, `generated=0, skipped=1`, `taskRepo.create` not called.
- [x] **AC5**: Test "AC5: 隔天（nextOccurrenceAt=tomorrow）呼叫 generate 只建立 tomorrow 的 task" — with `localDate=2026-03-06` and `nextOccurrenceAt=2026-03-06`, 1 task created for that date only.
- [x] **AC6**: Test "AC6: WEEKLY task（lead_days=0）在匹配的週一建立 task" — WEEKLY template with `daysOfWeek=[1]`, `nextOccurrenceAt=2026-03-09` (Monday), `localDate=2026-03-09` → 1 task created.

## Changed Files

- `api/prisma/schema.prisma` — line 156: `@default(1)` → `@default(0)`
- `api/prisma/migrations/20260313000000_recurring_task_lead_days_zero/migration.sql` — new migration (ALTER DEFAULT + UPDATE)
- `api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts` — added 6 new tests (AC3 ×2, AC4, AC5, AC6)

## Files NOT Modified (as required)

- `api/src/application/use-cases/recurring/generate-recurring-task-instances.ts` — untouched
- `api/src/application/use-cases/recurring/recurrence-utils.ts` — untouched
- `app/`, `web/` — untouched

## Verification Results

```
npm run lint   → tsc --noEmit: 0 errors
npm run test   → Test Files 102 passed (102) | Tests 999 passed | 8 skipped (1007)
npm run build  → Build succeeded, all routes compiled
```

Note on AC2 (integration): `npx prisma migrate dev --create-only` failed due to missing `vector` extension in the local shadow database (not a Cloud SQL environment). The migration SQL was hand-crafted following the same pattern as existing migrations and matches what Prisma would generate for an `ALTER COLUMN ... SET DEFAULT` change plus the required `UPDATE`.
