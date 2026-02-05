---
status: pending
priority: p2
issue_id: "006"
tags: [dry-principle, architecture, refactoring]
dependencies: []
---

# Consolidate Duplicate Domain Detection Logic

## Problem Statement

Domain normalization logic is duplicated in multiple locations across the codebase. The same `split(':')[0].replace(/^www\./, '').toLowerCase()` pattern appears in brand.ts and layout.tsx, creating a maintenance burden and potential for inconsistencies.

## Findings

**Duplication locations:**

1. **brand.ts** (lines 338):
   ```typescript
   const normalizedHost = host.split(':')[0].replace(/^www\./, '').toLowerCase()
   ```

2. **layout.tsx** (lines 73):
   ```typescript
   const domain = host ? host.split(':')[0].replace(/^www\./, '').toLowerCase() : undefined
   ```

3. **dashboard/page.tsx** (lines 113):
   ```typescript
   const hostname = window.location.hostname.replace(/^www\./, '').toLowerCase()
   ```

**Impact:**
- Maintenance burden - changes require updates in multiple places
- Risk of inconsistencies if logic diverges
- Violates DRY principle

## Proposed Solutions

### Option 1: Create Shared Utility Function (Recommended)

**Approach**: Extract normalization logic to a shared utility function.

**Pros:**
- Single source of truth
- Easy to test
- Can be reused across server and client

**Cons:**
- Minor refactoring required

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Use Existing getClientBrandInfo Everywhere

**Approach**: Replace manual detection with existing `getClientBrandInfo()` utility.

**Pros:**
- Uses existing utility
- Consistent with other parts of codebase

**Cons:**
- May not work in all contexts (server vs client)

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

Implement Option 1: Create a shared `normalizeDomain()` utility in `src/lib/domain.ts`.

**Example implementation:**
```typescript
// src/lib/domain.ts
export function normalizeDomain(host: string | null): string | null {
  if (!host) return null
  return host.split(':')[0].replace(/^www\./, '').toLowerCase()
}
```

## Technical Details

**Affected files:**
- `src/config/brand.ts:338` (update to use utility)
- `src/app/[locale]/(product)/app/layout.tsx:73` (update to use utility)
- `src/app/[locale]/(product)/app/dashboard/page.tsx:113` (update to use utility)
- `src/lib/domain.ts` (create new file or add to existing)

## Resources

- **Pattern Review**: Pattern Recognition Specialist identified this duplication
- **Git History**: Shows this pattern evolved organically

## Acceptance Criteria

- [ ] Shared utility function created
- [ ] All three locations updated to use utility
- [ ] Unit tests added for normalizeDomain function
- [ ] No behavioral changes (pure refactoring)

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Pattern Recognition Specialist)

**Actions:**
- Identified duplicate domain normalization logic
- Cataloged all three locations
- Documented utility function approach

**Learnings:**
- Domain normalization is a cross-cutting concern
- Shared utilities reduce maintenance burden
- Client and server normalization should use same logic
