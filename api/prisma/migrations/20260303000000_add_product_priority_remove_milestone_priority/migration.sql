-- CreateEnum
CREATE TYPE "priorityenum" AS ENUM ('P0', 'P1', 'P2', 'P3');

-- AlterTable: Add priority to products
ALTER TABLE "products" ADD COLUMN "priority" "priorityenum" NOT NULL DEFAULT 'P1';

-- AlterTable: Remove priority from milestones
ALTER TABLE "milestones" DROP COLUMN "priority";
