-- CreateEnum
CREATE TYPE "briefingtypeenum" AS ENUM ('MORNING', 'EVENING');

-- CreateTable
CREATE TABLE "coach_briefings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "briefingtypeenum" NOT NULL,
    "briefing_date" DATE NOT NULL,
    "calendar_events" JSON NOT NULL DEFAULT '[]',
    "overdue_tasks" JSON NOT NULL DEFAULT '[]',
    "approaching_tasks" JSON NOT NULL DEFAULT '[]',
    "conflicts" JSON NOT NULL DEFAULT '[]',
    "stagnations" JSON NOT NULL DEFAULT '[]',
    "completed_tasks" JSON NOT NULL DEFAULT '[]',
    "remaining_tasks" JSON NOT NULL DEFAULT '[]',
    "tomorrow_preview" JSON NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL,
    "recommendations" JSON NOT NULL DEFAULT '[]',
    "defer_suggestions" JSON NOT NULL DEFAULT '[]',

    CONSTRAINT "coach_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coach_briefings_user_id_type_briefing_date_key" ON "coach_briefings"("user_id", "type", "briefing_date");

-- CreateIndex
CREATE INDEX "coach_briefings_user_id_briefing_date_idx" ON "coach_briefings"("user_id", "briefing_date");

-- CreateIndex
CREATE INDEX "coach_briefings_user_id_type_created_at_idx" ON "coach_briefings"("user_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "coach_briefings" ADD CONSTRAINT "coach_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
