-- CreateTable
CREATE TABLE "sub_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" VARCHAR NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(6),
    "order" INTEGER NOT NULL DEFAULT 0,
    "start_date" TIMESTAMP(6),
    "due_date" TIMESTAMP(6),
    "estimated_minutes" INTEGER,
    "source" VARCHAR(20) NOT NULL DEFAULT 'user',
    "original_task_id" UUID,

    CONSTRAINT "sub_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_tasks_task_id_deleted_at_order_idx" ON "sub_tasks"("task_id", "deleted_at", "order");

-- CreateIndex
CREATE INDEX "sub_tasks_user_id_deleted_at_due_date_idx" ON "sub_tasks"("user_id", "deleted_at", "due_date");

-- CreateIndex
CREATE INDEX "sub_tasks_user_id_deleted_at_completed_idx" ON "sub_tasks"("user_id", "deleted_at", "completed");

-- AddForeignKey
ALTER TABLE "sub_tasks" ADD CONSTRAINT "sub_tasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sub_tasks" ADD CONSTRAINT "sub_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
