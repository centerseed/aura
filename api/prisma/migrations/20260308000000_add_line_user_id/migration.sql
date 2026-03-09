-- AlterTable
ALTER TABLE "users" ADD COLUMN "line_user_id" VARCHAR UNIQUE;
ALTER TABLE "users" ADD COLUMN "line_bound_at" TIMESTAMP(6);
ALTER TABLE "users" ADD COLUMN "line_binding_token" VARCHAR UNIQUE;
