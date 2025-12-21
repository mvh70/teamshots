-- AlterTable
ALTER TABLE "Team" ALTER COLUMN "name" DROP NOT NULL;

-- Data migration: Set default "My Team" names to NULL so users can complete setup
UPDATE "Team" SET "name" = NULL WHERE "name" IN ('My Team', 'My team');
