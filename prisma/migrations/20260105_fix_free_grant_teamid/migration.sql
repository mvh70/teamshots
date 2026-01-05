-- Fix free_grant credits that incorrectly have teamId set
-- These are personal credits for the admin, not team pool credits
-- This bug caused team admins to see -1 photo balance instead of their free trial credits

UPDATE "CreditTransaction"
SET "teamId" = NULL
WHERE type = 'free_grant'
AND "teamId" IS NOT NULL;
