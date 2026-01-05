-- Migration: Backfill personId on CreditTransaction records
-- This migration updates CreditTransaction records that have userId but no personId
-- to properly associate credits with the Person entity (business entity) rather than User (auth entity)

-- Backfill personId from userId where missing
-- This joins CreditTransaction to Person via the userId relationship
UPDATE "CreditTransaction" ct
SET "personId" = p.id
FROM "Person" p
WHERE ct."userId" = p."userId"
  AND ct."personId" IS NULL
  AND ct."userId" IS NOT NULL;

-- Log how many records were updated (for audit purposes in migration logs)
-- Note: This is informational and won't show in standard migration output
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM "CreditTransaction"
  WHERE "personId" IS NOT NULL AND "userId" IS NOT NULL;

  RAISE NOTICE 'CreditTransaction records with both personId and userId: %', updated_count;
END $$;
