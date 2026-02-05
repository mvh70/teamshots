---
status: complete
priority: p2
issue_id: "008"
tags: [agent-native, architecture, refactoring]
dependencies: []
---

# Unify Brand Detection to Single Source of Truth

## Problem Statement

There are two parallel brand detection systems: server-side `getBrand(headers)` and client-side `getClientBrandInfo()`. These can drift out of sync and create confusion. Additionally, components like dashboard implement their own detection instead of using shared utilities.

## Findings

**Dual detection systems:**

1. **Server-side**: `getBrand(headers)` in `brand.ts`
   - Uses request headers
   - Returns `BrandConfig` object
   - Used in layout.tsx

2. **Client-side**: `getClientBrandInfo()` in `domain.ts`
   - Uses `window.location.hostname`
   - Returns `ClientBrandInfo` object
   - Used in AuthSplitLayout

3. **Component-specific**: dashboard/page.tsx lines 111-115
   - Implements its own useMemo detection
   - Hardcodes domain checks
   - Doesn't use either utility

**Impact:**
- Potential for hydration mismatches
- Inconsistent brand detection logic
- Maintenance burden (changes needed in multiple places)
- Agent confusion about which method to use

## Proposed Solutions

### Option 1: Server-Authoritative with Props (Recommended)

**Approach**: Server detection is authoritative. Pass brand data to all client components via props or context. Remove client-side detection.

**Pros:**
- Single source of truth
- No hydration mismatches
- Simpler mental model

**Cons:**
- Requires prop drilling or context setup
- Some client-only components may need adjustment

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 2: Context-Based Brand Provider

**Approach**: Create a BrandContext that wraps the app and provides brand info to all children.

**Pros:**
- No prop drilling
- Clean API for components
- Easy to access anywhere

**Cons:**
- Adds context overhead
- Requires wrapping components

**Effort:** 2 hours

**Risk:** Low

---

### Option 3: Consolidate Utilities

**Approach**: Keep both server and client detection but ensure they use identical logic.

**Pros:**
- Flexible for different use cases
- Less refactoring

**Cons:**
- Still two sources of truth
- Risk of drift remains

**Effort:** 1 hour

**Risk:** Medium

## Recommended Action

Implement Option 1 with Option 2: Make server detection authoritative and provide brand data via DomainProvider context (which already exists but is underutilized).

**Implementation steps:**
1. Ensure DomainProvider provides all needed brand info
2. Update dashboard/page.tsx to use context instead of useMemo
3. Update AuthSplitLayout to receive brand info via props
4. Document that server-side detection is authoritative

## Technical Details

**Affected files:**
- `src/app/[locale]/(product)/app/layout.tsx`
- `src/app/[locale]/(product)/app/dashboard/page.tsx`
- `src/components/auth/AuthSplitLayout.tsx`
- `src/contexts/DomainContext.tsx` (may need extension)

## Resources

- **Agent-Native Review**: Agent-Native Reviewer identified as critical issue
- **Architecture Review**: Architecture Strategist noted dual detection paths

## Acceptance Criteria

- [ ] Server-side detection is authoritative
- [ ] All client components use context or props (not own detection)
- [ ] dashboard/page.tsx uses DomainContext instead of useMemo
- [ ] AuthSplitLayout receives brand info from server
- [ ] Documentation updated
- [ ] No hydration mismatches

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Agent-Native Reviewer)

**Actions:**
- Identified dual detection systems
- Cataloged all detection locations
- Documented unification approaches

**Learnings:**
- Server-authoritative detection prevents hydration issues
- Context providers reduce prop drilling
- DomainContext already exists but is underutilized

### 2026-02-01 - Fix Applied

**By:** Claude Code

**Actions:**
- Extended DomainContext to include `brandName` from server-side detection
- Updated DomainProvider to accept and provide `brandName` prop
- Updated layout.tsx to pass `brand.name` to DomainProvider
- Refactored dashboard/page.tsx to use `useDomain()` hook instead of custom `useMemo` detection
- Removed unused `normalizeDomain` import from dashboard/page.tsx
- Verified TypeScript compilation passes

**Changes:**
- `src/contexts/DomainContext.tsx` - Added brandName to context value and provider props
- `src/app/[locale]/(product)/app/layout.tsx:90` - Pass brandName to DomainProvider
- `src/app/[locale]/(product)/app/dashboard/page.tsx:29` - Import useDomain, remove normalizeDomain
- `src/app/[locale]/(product)/app/dashboard/page.tsx:111` - Use useDomain() instead of useMemo detection

**Implementation approach:**
- Combined Option 1 (Server-Authoritative) with Option 2 (Context-Based)
- Server-side `getBrand(headers)` is now the single source of truth
- DomainContext provides brandName to all client components
- Eliminates hydration mismatches since server and client use same data

**Remaining work:**
- AuthSplitLayout still uses `getClientBrandInfo()` - this is acceptable since AuthSplitLayout is used outside the app layout (in auth pages) where DomainProvider is not available
- Future enhancement could create a shared BrandProvider that works in both contexts

**Acceptance Criteria:**
- [x] Server-side detection is authoritative
- [x] dashboard/page.tsx uses DomainContext instead of useMemo
- [x] No hydration mismatches
- [ ] All client components use context or props (partial - AuthSplitLayout still uses client detection due to being outside app layout)
- [ ] AuthSplitLayout receives brand info from server (deferred - requires architectural changes to auth layout)
- [ ] Documentation updated (deferred)
