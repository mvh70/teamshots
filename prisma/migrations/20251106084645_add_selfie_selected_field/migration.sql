-- AlterTable
ALTER TABLE "Selfie" ADD COLUMN     "selected" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Selfie_selected_idx" ON "Selfie"("selected");
