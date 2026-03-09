-- CreateTable
CREATE TABLE "line_magic_links" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "line_user_id" VARCHAR NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "line_magic_links_token_key" ON "line_magic_links"("token");

-- CreateIndex
CREATE INDEX "line_magic_links_line_user_id_expires_at_idx" ON "line_magic_links"("line_user_id", "expires_at");
