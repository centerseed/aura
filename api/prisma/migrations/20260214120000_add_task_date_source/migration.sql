-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "date_source" VARCHAR(10);

-- Backfill: mark existing tasks with dates as user-set
UPDATE "tasks" SET "date_source" = 'user'
  WHERE ("start_date" IS NOT NULL OR "due_date" IS NOT NULL);
