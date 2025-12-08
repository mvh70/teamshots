/*
  Warnings:

  - Made the column `personId` on table `MobileHandoffToken` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MobileHandoffToken" ALTER COLUMN "personId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "MobileHandoffToken_personId_idx" ON "MobileHandoffToken"("personId");

-- AddForeignKey
ALTER TABLE "MobileHandoffToken" ADD CONSTRAINT "MobileHandoffToken_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
