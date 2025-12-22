-- Data migration: Set default "My Team" names to NULL so users can complete setup
-- Run this with: psql -d your_database_name -f scripts/fix-team-names.sql
-- Or execute directly in your database client

UPDATE "Team" SET "name" = NULL WHERE "name" IN ('My Team', 'My team');

-- Show affected rows
SELECT id, "name", "adminId", "createdAt" FROM "Team" WHERE "name" IS NULL;

