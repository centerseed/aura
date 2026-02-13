-- Add item_type column with default derived from sub_task_id
ALTER TABLE "daily_plan_items" ADD COLUMN "item_type" VARCHAR(10) NOT NULL DEFAULT 'subtask';

-- Backfill: tasks without sub_task_id are type 'task'
UPDATE "daily_plan_items" SET "item_type" = 'task' WHERE "sub_task_id" IS NULL;

-- Change due_date from TIMESTAMP to DATE
ALTER TABLE "daily_plan_items" ALTER COLUMN "due_date" TYPE DATE USING "due_date"::date;
