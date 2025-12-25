-- Drop indexes first
DROP INDEX IF EXISTS "ClothingOverlayCache_cacheKey_idx";
DROP INDEX IF EXISTS "ClothingOverlayCache_logoKey_style_detail_idx";

-- Drop table
DROP TABLE IF EXISTS "ClothingOverlayCache";
