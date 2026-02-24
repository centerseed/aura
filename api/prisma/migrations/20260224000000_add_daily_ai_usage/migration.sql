-- CreateTable
CREATE TABLE "daily_ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "usage_date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "daily_ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_ai_usage_user_id_usage_date_key" ON "daily_ai_usage"("user_id", "usage_date");

-- CreateIndex
CREATE INDEX "daily_ai_usage_user_id_usage_date_idx" ON "daily_ai_usage"("user_id", "usage_date");

-- AddForeignKey
ALTER TABLE "daily_ai_usage" ADD CONSTRAINT "daily_ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
