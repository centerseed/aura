-- CreateTable
CREATE TABLE "mcp_access_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(200) NOT NULL,
    "scope" VARCHAR(500) NOT NULL,
    "issued_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "last_used" TIMESTAMP(6),
    "revoked_at" TIMESTAMP(6),

    CONSTRAINT "mcp_access_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_access_tokens_token_hash_key" ON "mcp_access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_access_tokens_user_id_idx" ON "mcp_access_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mcp_access_tokens_expires_at_idx" ON "mcp_access_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "mcp_access_tokens" ADD CONSTRAINT "mcp_access_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
