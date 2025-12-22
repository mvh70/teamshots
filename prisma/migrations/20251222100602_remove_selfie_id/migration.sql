-- DropForeignKey
ALTER TABLE "Generation" DROP CONSTRAINT IF EXISTS "Generation_selfieId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Generation_selfieId_idx";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN IF EXISTS "selfieId";

