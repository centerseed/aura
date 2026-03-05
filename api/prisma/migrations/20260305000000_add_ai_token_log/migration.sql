-- AlterTable: add token columns to daily_ai_usage
ALTER TABLE "daily_ai_usage" ADD COLUMN IF NOT EXISTS "input_tokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_ai_usage" ADD COLUMN IF NOT EXISTS "output_tokens" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "daily_ai_usage" ADD COLUMN IF NOT EXISTS "total_tokens" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: ai_token_log
CREATE TABLE IF NOT EXISTS "ai_token_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "feature" VARCHAR(50) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ai_token_log_user_id_created_at_idx" ON "ai_token_log"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ai_token_log_feature_created_at_idx" ON "ai_token_log"("feature", "created_at");

-- AddForeignKey
ALTER TABLE "ai_token_log" ADD CONSTRAINT "ai_token_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
