-- Add status, user_adjusted, adjusted_at columns to daily_plan_items
ALTER TABLE "daily_plan_items" ADD COLUMN "status" VARCHAR(10) NOT NULL DEFAULT 'today';
ALTER TABLE "daily_plan_items" ADD COLUMN "user_adjusted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "daily_plan_items" ADD COLUMN "adjusted_at" TIMESTAMP(6);

-- Index for filtering by status
CREATE INDEX "daily_plan_items_plan_id_status_idx" ON "daily_plan_items"("plan_id", "status");
