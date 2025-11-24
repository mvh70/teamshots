-- AlterTable
ALTER TABLE "Context" ADD COLUMN     "packageName" TEXT NOT NULL DEFAULT 'headshot1';

-- CreateIndex
CREATE INDEX "Context_packageName_idx" ON "Context"("packageName");

-- AddForeignKey
ALTER TABLE "Context" ADD CONSTRAINT "Context_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
