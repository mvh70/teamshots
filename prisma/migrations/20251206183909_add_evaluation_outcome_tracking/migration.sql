-- AlterTable
ALTER TABLE "GenerationCost" ADD COLUMN     "evaluationStatus" TEXT,
ADD COLUMN     "intermediateS3Key" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "GenerationCost_evaluationStatus_idx" ON "GenerationCost"("evaluationStatus");
