-- AlterTable: change default value of lead_days from 1 to 0
ALTER TABLE "recurring_tasks" ALTER COLUMN "lead_days" SET DEFAULT 0;

-- Update existing records: set all lead_days = 1 to 0
-- (UI never exposed lead_days setting, so all rows should be 1 from the old default)
UPDATE recurring_tasks SET lead_days = 0 WHERE lead_days = 1;
