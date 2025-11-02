-- Add firstName column as nullable first
ALTER TABLE "TeamInvite" ADD COLUMN "firstName" TEXT;

-- Update existing rows with a default value (extract from email or use 'Guest')
UPDATE "TeamInvite" 
SET "firstName" = COALESCE(
  SPLIT_PART("email", '@', 1),
  'Guest'
)
WHERE "firstName" IS NULL;

-- Now make it NOT NULL
ALTER TABLE "TeamInvite" ALTER COLUMN "firstName" SET NOT NULL;
