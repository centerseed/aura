-- CreateTable
CREATE TABLE "daily_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_date" DATE NOT NULL,
    "coach_message" TEXT,
    "capacity_note" TEXT,
    "available_minutes" INTEGER,
    "meeting_minutes" INTEGER,
    "planned_minutes" INTEGER,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "plan_id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "sub_task_id" UUID,
    "content" VARCHAR NOT NULL,
    "area_name" VARCHAR NOT NULL,
    "product_name" VARCHAR NOT NULL,
    "estimated_minutes" INTEGER,
    "due_date" TIMESTAMP(6),
    "order" INTEGER NOT NULL,
    "reasoning" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(6),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "deferred" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "daily_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_user_id_plan_date_key" ON "daily_plans"("user_id", "plan_date");

-- CreateIndex
CREATE INDEX "daily_plans_user_id_plan_date_idx" ON "daily_plans"("user_id", "plan_date");

-- CreateIndex
CREATE INDEX "daily_plan_items_plan_id_order_idx" ON "daily_plan_items"("plan_id", "order");

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "daily_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "daily_plan_items" ADD CONSTRAINT "daily_plan_items_sub_task_id_fkey" FOREIGN KEY ("sub_task_id") REFERENCES "sub_tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
