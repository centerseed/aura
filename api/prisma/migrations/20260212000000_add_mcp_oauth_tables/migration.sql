-- CreateTable
CREATE TABLE "mcp_auth_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(200) NOT NULL,
    "redirect_uri" VARCHAR(2000) NOT NULL,
    "code_challenge" VARCHAR(128) NOT NULL,
    "scope" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" VARCHAR(128) NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" VARCHAR(200) NOT NULL,
    "scope" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(6),

    CONSTRAINT "mcp_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_auth_codes_code_key" ON "mcp_auth_codes"("code");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_code_idx" ON "mcp_auth_codes"("code");

-- CreateIndex
CREATE INDEX "mcp_auth_codes_expires_at_idx" ON "mcp_auth_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_refresh_tokens_token_hash_key" ON "mcp_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "mcp_refresh_tokens_user_id_idx" ON "mcp_refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mcp_refresh_tokens_expires_at_idx" ON "mcp_refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "mcp_refresh_tokens" ADD CONSTRAINT "mcp_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
