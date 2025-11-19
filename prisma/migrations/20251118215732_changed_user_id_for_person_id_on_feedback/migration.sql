/*
  Warnings:

  - You are about to drop the column `userId` on the `Feedback` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_userId_fkey";

-- DropIndex
DROP INDEX "Feedback_userId_idx";

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "userId",
ADD COLUMN     "personId" TEXT;

-- CreateIndex
CREATE INDEX "Feedback_personId_idx" ON "Feedback"("personId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
