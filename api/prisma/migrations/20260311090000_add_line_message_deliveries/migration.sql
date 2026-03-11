CREATE TYPE "linemessagechannelenum" AS ENUM ('LINE');
CREATE TYPE "linedeliverytypeenum" AS ENUM ('MORNING_BRIEFING');
CREATE TYPE "linedeliverystatusenum" AS ENUM ('sent', 'failed');

CREATE TABLE "line_message_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID NOT NULL,
    "channel" "linemessagechannelenum" NOT NULL,
    "delivery_type" "linedeliverytypeenum" NOT NULL,
    "delivery_date" DATE NOT NULL,
    "briefing_id" UUID,
    "daily_plan_id" UUID,
    "line_user_id" VARCHAR NOT NULL,
    "status" "linedeliverystatusenum" NOT NULL,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(6),

    CONSTRAINT "line_message_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_message_deliveries_user_id_channel_delivery_type_delivery_key"
ON "line_message_deliveries"("user_id", "channel", "delivery_type", "delivery_date");

CREATE INDEX "line_message_deliveries_delivery_date_channel_delivery_type_idx"
ON "line_message_deliveries"("delivery_date", "channel", "delivery_type");

CREATE INDEX "line_message_deliveries_line_user_id_delivery_date_idx"
ON "line_message_deliveries"("line_user_id", "delivery_date");

ALTER TABLE "line_message_deliveries"
ADD CONSTRAINT "line_message_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "line_message_deliveries"
ADD CONSTRAINT "line_message_deliveries_briefing_id_fkey"
FOREIGN KEY ("briefing_id") REFERENCES "coach_briefings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "line_message_deliveries"
ADD CONSTRAINT "line_message_deliveries_daily_plan_id_fkey"
FOREIGN KEY ("daily_plan_id") REFERENCES "daily_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
