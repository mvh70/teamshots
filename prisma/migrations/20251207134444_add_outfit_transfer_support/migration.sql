-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "generationType" TEXT NOT NULL DEFAULT 'headshot',
ADD COLUMN     "outfitAssetId" TEXT,
ADD COLUMN     "outfitReferenceKey" TEXT;

-- CreateIndex
CREATE INDEX "Generation_generationType_idx" ON "Generation"("generationType");

-- CreateIndex
CREATE INDEX "Generation_outfitAssetId_idx" ON "Generation"("outfitAssetId");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_outfitAssetId_fkey" FOREIGN KEY ("outfitAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
