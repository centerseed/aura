CREATE TYPE "agentchatturnchannelenum" AS ENUM ('API', 'LINE');

CREATE TYPE "agentchatturnstatusenum" AS ENUM ('SUCCESS', 'ERROR');

CREATE TABLE "agent_chat_turns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "channel" "agentchatturnchannelenum" NOT NULL,
    "session_id" VARCHAR(255) NOT NULL,
    "request_text" TEXT NOT NULL,
    "response_text" TEXT,
    "tool_calls" JSON NOT NULL DEFAULT '[]',
    "intent" JSON,
    "usage" JSON,
    "timings" JSON,
    "trace" JSON,
    "metadata" JSON,
    "status" "agentchatturnstatusenum" NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_chat_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_chat_turns_user_id_created_at_idx"
ON "agent_chat_turns"("user_id", "created_at");

CREATE INDEX "agent_chat_turns_channel_created_at_idx"
ON "agent_chat_turns"("channel", "created_at");

CREATE INDEX "agent_chat_turns_session_id_created_at_idx"
ON "agent_chat_turns"("session_id", "created_at");

CREATE INDEX "agent_chat_turns_status_created_at_idx"
ON "agent_chat_turns"("status", "created_at");

ALTER TABLE "agent_chat_turns"
ADD CONSTRAINT "agent_chat_turns_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
