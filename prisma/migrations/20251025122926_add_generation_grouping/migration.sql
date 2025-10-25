-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "generationGroupId" TEXT,
ADD COLUMN     "groupIndex" INTEGER,
ADD COLUMN     "isOriginal" BOOLEAN NOT NULL DEFAULT true;
