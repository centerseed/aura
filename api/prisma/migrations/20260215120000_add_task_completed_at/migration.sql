-- Add completed_at column to tasks table
ALTER TABLE "tasks" ADD COLUMN "completed_at" TIMESTAMP(6);

-- Backfill: for existing ARCHIVE tasks, use due_date if available
UPDATE "tasks" SET "completed_at" = "due_date" WHERE "status" = 'ARCHIVE' AND "completed_at" IS NULL AND "due_date" IS NOT NULL;
