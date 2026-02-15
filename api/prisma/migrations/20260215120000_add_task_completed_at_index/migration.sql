-- CreateIndex
CREATE INDEX "tasks_user_id_status_completed_at_idx" ON "tasks"("user_id", "status", "completed_at");
