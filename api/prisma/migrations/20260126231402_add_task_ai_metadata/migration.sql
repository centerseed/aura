-- CreateTable
-- Add task_ai_metadata table for optimized AI analysis data storage
-- This table stores frequently updated AI metadata separately from the main JSON field
-- to enable batch updates during reorganization operations

CREATE TABLE "task_ai_metadata" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "task_id" UUID NOT NULL,
    "time_inference_reasoning" TEXT,
    "urgency_level" VARCHAR(20),
    "reorganized_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_ai_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Unique constraint to ensure one-to-one relationship with tasks
CREATE UNIQUE INDEX "task_ai_metadata_task_id_key" ON "task_ai_metadata"("task_id");

-- CreateIndex
-- Index for querying by urgency level (e.g., find all critical tasks)
CREATE INDEX "task_ai_metadata_urgency_level_idx" ON "task_ai_metadata"("urgency_level");

-- CreateIndex
-- Index for querying recently reorganized tasks
CREATE INDEX "task_ai_metadata_reorganized_at_idx" ON "task_ai_metadata"("reorganized_at");

-- AddForeignKey
-- Cascade delete: when a task is deleted, its metadata is also deleted
ALTER TABLE "task_ai_metadata" ADD CONSTRAINT "task_ai_metadata_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
