-- AlterTable
ALTER TABLE "Selfie" ADD COLUMN     "improperReason" TEXT,
ADD COLUMN     "isProper" BOOLEAN,
ADD COLUMN     "personCount" INTEGER,
ADD COLUMN     "selfieType" TEXT,
ADD COLUMN     "selfieTypeConfidence" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Selfie_selfieType_idx" ON "Selfie"("selfieType");
