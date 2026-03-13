# Ship Report: recurring-task-duplicate

## Result: SUCCESS

## AC Status
- [x] AC1: lead_days 預設值改為 0 — PASS (schema diff verified)
- [x] AC2: 現有 records UPDATE 為 0 — PASS (migration SQL contains ALTER DEFAULT + UPDATE)
- [x] AC3: DAILY lead_days=0 只建今天的卡 — PASS (2 unit tests: create today + skip tomorrow)
- [x] AC4: 多次 generate 不重複 — PASS (unit test: dedup with lead_days=0)
- [x] AC5: 隔天只建新的 1 張卡 — PASS (unit test: next-day generation)
- [x] AC6: WEEKLY task 不受影響 — PASS (unit test: weekly with lead_days=0)

## Test Results
| Suite | Result | Details |
|-------|--------|---------|
| API lint (tsc) | PASS | 0 errors |
| API unit tests | PASS | 15/15 passed (recurring file), 19/19 passed (full suite) |
| API build | PASS | all routes compiled |

## Review Verdicts
- Spec Review: PASS (all 6 ACs verified, no blocking issues)
- /simplify Code Reuse: Clean
- /simplify Code Quality: Clean
- /simplify Efficiency: Clean (migration acceptable at current scale)

## Fix Loop Iterations: 0

## Changed Files
- `api/prisma/schema.prisma` — `lead_days @default(1)` → `@default(0)` (1 line)
- `api/prisma/migrations/20260313000000_recurring_task_lead_days_zero/migration.sql` — ALTER DEFAULT + UPDATE existing records (new file)
- `api/tests/unit/use-cases/recurring/generate-recurring-task-instances.test.ts` — 6 new tests for AC3-AC6 (96 lines added)

## Deployment
- Required: YES
- Services: [api]
- Status: PENDING USER CONFIRMATION
- Note: Migration must run first (`npx prisma migrate deploy`)
