---
status: complete
priority: p1
issue_id: "001"
tags: [performance, react, css-variables]
dependencies: []
---

# Memoize brandStyle Object to Prevent Unnecessary Re-renders

## Problem Statement

The `brandStyle` object in AppShell.tsx is recreated on every render without memoization, causing unnecessary React re-renders and style recalculations. This impacts performance, especially during frequent state changes like sidebar toggling.

## Findings

- **Location**: `src/app/[locale]/(product)/app/AppShell.tsx` lines 187-202
- The `brandStyle` object is constructed inline on every render:
  ```typescript
  const brandStyle = brandColors ? {
    '--brand-primary': brandColors.primary,
    '--brand-primary-hover': brandColors.primaryHover,
    // ... 9 more properties
  } as React.CSSProperties : undefined
  ```
- Object recreation triggers React's diffing algorithm for the style prop
- Each recreation forces browser to re-parse and apply CSS variables
- Impact increases with frequent state updates (sidebar hover, session updates)

## Proposed Solutions

### Option 1: Wrap in useMemo (Recommended)

**Approach**: Wrap `brandStyle` construction in `useMemo` hook with proper dependencies.

**Pros:**
- Minimal code change
- React best practice for derived values
- Eliminates unnecessary object recreation

**Cons:**
- Adds hook dependency array maintenance

**Effort:** 15 minutes

**Risk:** Low

---

### Option 2: Move to Brand Config

**Approach**: Pre-compute CSS variables in the brand configuration and pass them ready-to-use.

**Pros:**
- Zero runtime computation
- Single source of truth
- Works with server components

**Cons:**
- Requires brand config restructuring
- More invasive change

**Effort:** 2-3 hours

**Risk:** Medium

---

### Option 3: Use CSS Classes Instead of Inline Styles

**Approach**: Use static CSS classes with attribute selectors instead of dynamic inline styles.

**Pros:**
- No JavaScript overhead
- Leverages browser's CSS engine
- Better caching

**Cons:**
- Requires significant refactoring
- Loses some dynamic flexibility

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Implement Option 1 (useMemo) immediately as a quick fix. Consider Option 2 or 3 for future refactoring.

## Technical Details

**Affected files:**
- `src/app/[locale]/(product)/app/AppShell.tsx:187-202`

**Related components:**
- All child components that inherit CSS variables

**Dependencies:**
- React useMemo hook

## Resources

- **Performance Review**: Agent analysis showed this as P0 critical issue
- **React Docs**: https://react.dev/reference/react/useMemo

## Acceptance Criteria

- [ ] brandStyle wrapped in useMemo with correct dependencies
- [ ] No console warnings about missing dependencies
- [ ] Visual appearance unchanged
- [ ] Performance profiling shows reduced re-renders

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Performance Oracle Agent)

**Actions:**
- Identified unmemoized brandStyle object construction
- Analyzed impact on render performance
- Documented three solution approaches

**Learnings:**
- Object recreation on every render is a common React performance anti-pattern
- CSS variable injection via inline styles benefits from memoization

### 2026-02-01 - Fix Applied

**By:** Claude Code

**Actions:**
- Added `useMemo` import from React
- Wrapped `brandStyle` object construction in `useMemo`
- Set dependencies to `[brandColors, isIndividualDomain]`
- Verified TypeScript compilation passes

**Changes:**
- `src/app/[locale]/(product)/app/AppShell.tsx:6` - Added `useMemo` to imports
- `src/app/[locale]/(product)/app/AppShell.tsx:179-197` - Wrapped brandStyle in useMemo
