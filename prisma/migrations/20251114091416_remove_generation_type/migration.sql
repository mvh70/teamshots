/*
  Warnings:

  - You are about to drop the column `generationType` on the `Generation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Generation_generationType_idx";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN "generationType";
