/*
  Warnings:

  - A unique constraint covering the columns `[outputAssetId]` on the table `Generation` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[assetId]` on the table `Selfie` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "outputAssetId" TEXT;

-- AlterTable
ALTER TABLE "Selfie" ADD COLUMN     "assetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subType" TEXT,
    "mimeType" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "teamId" TEXT,
    "personId" TEXT,
    "parentAssetIds" TEXT[],
    "styleFingerprint" TEXT,
    "styleContext" JSONB,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "temporary" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationCost" (
    "id" TEXT NOT NULL,
    "generationId" TEXT,
    "personId" TEXT,
    "teamId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "workflowVersion" TEXT,
    "stepName" TEXT,
    "outputAssetId" TEXT,
    "reusedAssetId" TEXT,
    "costSaved" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationCost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_s3Key_key" ON "Asset"("s3Key");

-- CreateIndex
CREATE INDEX "Asset_type_subType_idx" ON "Asset"("type", "subType");

-- CreateIndex
CREATE INDEX "Asset_styleFingerprint_idx" ON "Asset"("styleFingerprint");

-- CreateIndex
CREATE INDEX "Asset_ownerType_teamId_idx" ON "Asset"("ownerType", "teamId");

-- CreateIndex
CREATE INDEX "Asset_ownerType_personId_idx" ON "Asset"("ownerType", "personId");

-- CreateIndex
CREATE INDEX "Asset_expiresAt_idx" ON "Asset"("expiresAt");

-- CreateIndex
CREATE INDEX "GenerationCost_generationId_idx" ON "GenerationCost"("generationId");

-- CreateIndex
CREATE INDEX "GenerationCost_personId_idx" ON "GenerationCost"("personId");

-- CreateIndex
CREATE INDEX "GenerationCost_teamId_idx" ON "GenerationCost"("teamId");

-- CreateIndex
CREATE INDEX "GenerationCost_createdAt_idx" ON "GenerationCost"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Generation_outputAssetId_key" ON "Generation"("outputAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "Selfie_assetId_key" ON "Selfie"("assetId");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selfie" ADD CONSTRAINT "Selfie_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationCost" ADD CONSTRAINT "GenerationCost_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
