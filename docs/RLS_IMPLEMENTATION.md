# PostgreSQL Row-Level Security (RLS) Implementation Strategy

## Overview

This document outlines the implementation strategy for PostgreSQL Row-Level Security (RLS) to provide database-level access control as a defense-in-depth security measure.

## Current State

The application currently uses **application-level RLS** implemented in `src/lib/prisma-rls.ts` with Prisma middleware. This provides good security but can be bypassed if the application layer is compromised.

## Proposed Database-Level RLS Implementation

### 1. Enable RLS on Critical Tables

```sql
-- Enable RLS on all user-data tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Generation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Selfie" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Context" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
```

### 2. Create RLS Policies

#### User Table Policies
```sql
-- Users can only access their own records
CREATE POLICY "Users can access own data" ON "User"
  FOR ALL USING (id = current_setting('app.current_user_id')::uuid);

-- Allow system operations (for migrations, etc.)
CREATE POLICY "System access" ON "User"
  FOR ALL USING (current_setting('app.system_mode', true) = 'true');
```

#### Person Table Policies
```sql
-- Users can access their own person record
CREATE POLICY "Users can access own person" ON "Person"
  FOR ALL USING (user_id = current_setting('app.current_user_id')::uuid);

-- Company members can access other persons in same company
CREATE POLICY "Company members access" ON "Person"
  FOR SELECT USING (
    company_id = (
      SELECT company_id FROM "Person" 
      WHERE user_id = current_setting('app.current_user_id')::uuid
    )
  );
```

#### Generation Table Policies
```sql
-- Users can access their own generations
CREATE POLICY "Users can access own generations" ON "Generation"
  FOR ALL USING (person_id = (
    SELECT id FROM "Person" 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

-- Company members can access company generations
CREATE POLICY "Company generations access" ON "Generation"
  FOR SELECT USING (
    generation_type = 'company' AND
    person_id IN (
      SELECT id FROM "Person" 
      WHERE company_id = (
        SELECT company_id FROM "Person" 
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    )
  );
```

#### Selfie Table Policies
```sql
-- Users can access their own selfies
CREATE POLICY "Users can access own selfies" ON "Selfie"
  FOR ALL USING (person_id = (
    SELECT id FROM "Person" 
    WHERE user_id = current_setting('app.current_user_id')::uuid
  ));

-- Company members can access company selfies
CREATE POLICY "Company selfies access" ON "Selfie"
  FOR SELECT USING (
    person_id IN (
      SELECT id FROM "Person" 
      WHERE company_id = (
        SELECT company_id FROM "Person" 
        WHERE user_id = current_setting('app.current_user_id')::uuid
      )
    )
  );
```

### 3. Session Context Setup

Create a function to set the current user context:

```sql
CREATE OR REPLACE FUNCTION set_user_context(user_id uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4. Prisma Integration

Update the Prisma client to set user context:

```typescript
// In src/lib/prisma.ts
export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Add middleware to set user context
prisma.$use(async (params, next) => {
  // Set user context for RLS
  if (params.action !== 'create' && params.action !== 'update' && params.action !== 'delete') {
    // Only for read operations, set the current user
    const userId = getCurrentUserId() // Implement this function
    if (userId) {
      await prisma.$executeRaw`SELECT set_user_context(${userId})`
    }
  }
  
  return next(params)
})
```

## Implementation Steps

### Phase 1: Preparation
1. **Backup Database**: Create full backup before making changes
2. **Test Environment**: Implement and test in staging environment first
3. **Documentation**: Document all current queries and access patterns

### Phase 2: Policy Creation
1. **Create Policies**: Implement the RLS policies above
2. **Test Policies**: Verify policies work correctly with test data
3. **Performance Testing**: Ensure RLS doesn't significantly impact performance

### Phase 3: Application Integration
1. **Update Prisma Client**: Add user context setting
2. **Update Authentication**: Ensure user context is set on all requests
3. **Testing**: Comprehensive testing of all user flows

### Phase 4: Monitoring
1. **Logging**: Add logging for RLS policy violations
2. **Performance Monitoring**: Monitor query performance
3. **Security Monitoring**: Monitor for unauthorized access attempts

## Security Benefits

1. **Defense in Depth**: Database-level protection even if application is compromised
2. **Data Isolation**: Ensures users can only access their own data
3. **Company Boundaries**: Enforces company-level data isolation
4. **Audit Trail**: Database-level logging of access attempts

## Considerations

1. **Performance Impact**: RLS adds overhead to queries
2. **Complexity**: More complex debugging and maintenance
3. **Migration**: Requires careful migration planning
4. **Testing**: More complex testing scenarios

## Rollback Plan

1. **Disable RLS**: `ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;`
2. **Drop Policies**: Remove all RLS policies
3. **Revert Application**: Remove user context setting
4. **Restore Backup**: If necessary, restore from backup

## Testing Checklist

- [ ] User can only access their own data
- [ ] Company members can access company data
- [ ] Users cannot access other users' data
- [ ] System operations work correctly
- [ ] Performance is acceptable
- [ ] Error handling works correctly
- [ ] Logging captures violations

## Next Steps

1. **Review**: Team review of this implementation plan
2. **Staging**: Implement in staging environment
3. **Testing**: Comprehensive testing
4. **Production**: Gradual rollout with monitoring
