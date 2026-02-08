-- CreateEnum
CREATE TYPE "remindertypeenum" AS ENUM ('CALENDAR_REMINDER', 'LOCAL_NOTIFICATION');

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "calendar_event_id" VARCHAR NOT NULL,
    "summary" VARCHAR NOT NULL,
    "description" TEXT,
    "start_date_time" TIMESTAMP(6) NOT NULL,
    "end_date_time" TIMESTAMP(6) NOT NULL,
    "meet_link" VARCHAR,
    "event_link" VARCHAR NOT NULL,
    "attendees" VARCHAR[] DEFAULT ARRAY[]::VARCHAR[],

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "user_id" UUID NOT NULL,
    "task_id" UUID,
    "calendar_event_id" UUID,
    "remind_at" TIMESTAMP(6) NOT NULL,
    "message" VARCHAR,
    "reminder_type" "remindertypeenum" NOT NULL,
    "notification_id" INTEGER,
    "calendar_remind_event_id" VARCHAR,

    CONSTRAINT "reminder_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_events_calendar_event_id_key" ON "calendar_events"("calendar_event_id");

-- CreateIndex
CREATE INDEX "calendar_events_user_id_deleted_at_idx" ON "calendar_events"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "calendar_events_task_id_deleted_at_idx" ON "calendar_events"("task_id", "deleted_at");

-- CreateIndex
CREATE INDEX "calendar_events_start_date_time_idx" ON "calendar_events"("start_date_time");

-- CreateIndex
CREATE INDEX "reminder_configs_user_id_deleted_at_idx" ON "reminder_configs"("user_id", "deleted_at");

-- CreateIndex
CREATE INDEX "reminder_configs_task_id_deleted_at_idx" ON "reminder_configs"("task_id", "deleted_at");

-- CreateIndex
CREATE INDEX "reminder_configs_calendar_event_id_deleted_at_idx" ON "reminder_configs"("calendar_event_id", "deleted_at");

-- CreateIndex
CREATE INDEX "reminder_configs_remind_at_idx" ON "reminder_configs"("remind_at");

-- CreateIndex
CREATE INDEX "reminder_configs_user_id_reminder_type_remind_at_idx" ON "reminder_configs"("user_id", "reminder_type", "remind_at");

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reminder_configs" ADD CONSTRAINT "reminder_configs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "reminder_configs" ADD CONSTRAINT "reminder_configs_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
