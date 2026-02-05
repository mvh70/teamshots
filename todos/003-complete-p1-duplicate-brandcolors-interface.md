---
status: complete
priority: p1
issue_id: "003"
tags: [typescript, architecture, dry-principle]
dependencies: []
---

# Remove Duplicate BrandColors Interface

## Problem Statement

The `BrandColors` interface is defined twice - once in `brand.ts` and again in `AppShell.tsx`. This violates DRY principles and creates maintenance overhead. Changes to brand colors require updates in multiple places.

## Findings

- **Location 1**: `src/config/brand.ts` lines 18-25 (canonical definition)
- **Location 2**: `src/app/[locale]/(product)/app/AppShell.tsx` lines 34-41 (duplicate)
- Both interfaces have identical structure:
  ```typescript
  interface BrandColors {
    primary: string
    primaryHover: string
    secondary: string
    secondaryHover: string
    cta: string
    ctaHover: string
  }
  ```
- Creates type safety gap - changes may not sync between definitions
- Increases bundle size slightly

## Proposed Solutions

### Option 1: Import from Canonical Source (Recommended)

**Approach**: Remove local definition and import from `brand.ts`.

**Pros:**
- Single source of truth
- Type changes propagate automatically
- Follows DRY principle
- Minimal code change

**Cons:**
- None

**Effort:** 5 minutes

**Risk:** None

---

### Option 2: Create Shared Types File

**Approach**: Move all brand-related types to a separate types file.

**Pros:**
- Centralized type definitions
- Better organization for large codebases

**Cons:**
- Overkill for current scope
- Adds file fragmentation

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

Implement Option 1: Remove the duplicate interface from AppShell.tsx and import from `brand.ts`.

## Technical Details

**Affected files:**
- `src/app/[locale]/(product)/app/AppShell.tsx:34-41` (remove)
- `src/app/[locale]/(product)/app/AppShell.tsx` (add import)

**Import statement:**
```typescript
import type { BrandColors } from '@/config/brand'
```

## Resources

- **Code Review**: Kieran TypeScript Reviewer flagged this issue
- **TypeScript Docs**: https://www.typescriptlang.org/docs/handbook/modules.html

## Acceptance Criteria

- [ ] Duplicate interface removed from AppShell.tsx
- [ ] Import statement added for BrandColors
- [ ] TypeScript compilation passes
- [ ] No runtime changes (pure refactoring)

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Kieran TypeScript Reviewer)

**Actions:**
- Identified duplicate interface definitions
- Verified identical structure
- Documented import-based solution

**Learnings:**
- Duplicate type definitions are a common maintenance issue
- TypeScript's type-only imports help avoid circular dependencies

### 2026-02-01 - Fix Applied

**By:** Claude Code

**Actions:**
- Added import for `BrandColors` type from `@/config/brand`
- Removed duplicate `BrandColors` interface from AppShell.tsx
- Verified TypeScript compilation passes

**Changes:**
- `src/app/[locale]/(product)/app/AppShell.tsx:13` - Added `import type { BrandColors } from '@/config/brand'`
- `src/app/[locale]/(product)/app/AppShell.tsx:34-41` - Removed duplicate interface
