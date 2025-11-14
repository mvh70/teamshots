# Migration: Remove `generationType` Column

## Overview
The `generationType` field has been removed from the `Generation` model in Prisma schema. Generation type is now derived from `person.teamId` (if `person.teamId` is set, it's a team generation; otherwise, it's personal).

## Prerequisites
- All code changes have been applied
- Database backup has been created
- You have access to run Prisma migrations

## Migration Steps

### 1. Create the Migration
Run Prisma migrate to generate the migration file:

```bash
npx prisma migrate dev --name remove_generation_type
```

This will:
- Generate a migration file in `prisma/migrations/`
- Remove the `generationType` column from the `Generation` table
- Remove the index on `generationType`

### 2. Review the Generated Migration
Check the generated migration file in `prisma/migrations/[timestamp]_remove_generation_type/migration.sql`. It should contain:

```sql
-- DropIndex
DROP INDEX IF EXISTS "Generation_generationType_idx";

-- AlterTable
ALTER TABLE "Generation" DROP COLUMN IF EXISTS "generationType";
```

### 3. Apply the Migration

**For Development:**
```bash
npx prisma migrate dev
```

**For Production:**
```bash
# First, generate the migration without applying
npx prisma migrate dev --create-only --name remove_generation_type

# Review the migration file, then apply it
npx prisma migrate deploy
```

### 4. Verify the Migration

After applying, verify the column has been removed:

```sql
-- Connect to your database and run:
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'Generation' 
AND column_name = 'generationType';
-- Should return 0 rows

-- Verify index is removed:
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'Generation' 
AND indexname LIKE '%generationType%';
-- Should return 0 rows
```

### 5. Update Prisma Client

After migration, regenerate Prisma Client:

```bash
npx prisma generate
```

## Rollback (If Needed)

If you need to rollback, create a new migration that adds the column back:

```sql
-- Add column back
ALTER TABLE "Generation" 
ADD COLUMN "generationType" TEXT DEFAULT 'personal';

-- Recreate index
CREATE INDEX "Generation_generationType_idx" ON "Generation"("generationType");

-- Populate existing data based on person.teamId
UPDATE "Generation" g
SET "generationType" = CASE 
  WHEN EXISTS (
    SELECT 1 FROM "Person" p 
    WHERE p.id = g."personId" AND p."teamId" IS NOT NULL
  ) THEN 'team'
  ELSE 'personal'
END;
```

## Notes

- **No Data Loss**: The `generationType` value can be derived from `person.teamId`, so no data is lost
- **Backward Compatibility**: All API responses still include `generationType` (derived on-the-fly)
- **Performance**: Filtering now uses `person.teamId` instead of `generationType`, which is more efficient
- **Single Source of Truth**: `person.teamId` is now the authoritative source for determining generation type

## Testing Checklist

After migration, verify:
- [ ] New generations are created without `generationType` field
- [ ] API endpoints return `generationType` correctly (derived from `person.teamId`)
- [ ] List endpoints filter correctly by `person.teamId`
- [ ] Dashboard activity shows correct generation types
- [ ] Team member endpoints work correctly
- [ ] No Prisma errors in logs

