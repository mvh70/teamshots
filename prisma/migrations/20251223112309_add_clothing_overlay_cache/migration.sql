-- CreateTable
CREATE TABLE "ClothingOverlayCache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "logoKey" TEXT,
    "style" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClothingOverlayCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClothingOverlayCache_cacheKey_key" ON "ClothingOverlayCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ClothingOverlayCache_cacheKey_idx" ON "ClothingOverlayCache"("cacheKey");

-- CreateIndex
CREATE INDEX "ClothingOverlayCache_logoKey_style_detail_idx" ON "ClothingOverlayCache"("logoKey", "style", "detail");
