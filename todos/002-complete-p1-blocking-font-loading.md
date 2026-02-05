---
status: complete
priority: p1
issue_id: "002"
tags: [performance, fonts, css]
dependencies: []
---

# Fix Blocking Google Fonts Loading in AuthSplitLayout

## Problem Statement

Google Fonts are loaded via `@import` in styled-jsx global styles, which blocks the critical rendering path and delays First Contentful Paint (FCP). No font-display strategy is specified, causing invisible text during font loading.

## Findings

- **Location**: `src/components/auth/AuthSplitLayout.tsx` lines 57-61
- Current implementation:
  ```typescript
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display...');
    .font-serif { font-family: 'Playfair Display', serif; }
  `}</style>
  ```
- `@import` in CSS is render-blocking
- No `display=swap` parameter in font URL
- styled-jsx injects styles into document, potentially causing FOUC
- Affects PhotoShotsPro auth pages (signin/signup)

## Proposed Solutions

### Option 1: Use next/font/google (Recommended)

**Approach**: Import fonts via `next/font/google` with display: 'swap'.

**Pros:**
- Next.js optimized font loading
- Automatic font optimization
- No external requests at runtime
- Built-in display: swap support

**Cons:**
- Requires restructuring component
- Font files included in build

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Add display=swap and Preload

**Approach**: Modify current approach with font-display: swap and preload link.

**Pros:**
- Minimal code changes
- Prevents invisible text
- Faster than current implementation

**Cons:**
- Still relies on external service
- Not as optimized as next/font

**Effort:** 30 minutes

**Risk:** Low

---

### Option 3: Self-Host Fonts

**Approach**: Download and self-host font files.

**Pros:**
- No external dependencies
- Full control over caching
- Best performance

**Cons:**
- Requires font file management
- Licensing considerations
- More setup work

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

Implement Option 1 (next/font/google) for best performance and maintainability. This is the Next.js recommended approach.

## Technical Details

**Affected files:**
- `src/components/auth/AuthSplitLayout.tsx:57-61`

**Related components:**
- Signin page
- Signup page

**Dependencies:**
- next/font/google module

## Resources

- **Performance Review**: Agent analysis flagged as P0 critical
- **Next.js Docs**: https://nextjs.org/docs/app/building-your-application/optimizing/fonts

## Acceptance Criteria

- [ ] Fonts load without blocking render
- [ ] No FOUC (Flash of Unstyled Content)
- [ ] Text visible immediately with fallback font
- [ ] Lighthouse performance score improved
- [ ] Fonts work in both PhotoShotsPro and TeamShotsPro layouts

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Performance Oracle Agent)

**Actions:**
- Identified blocking font loading pattern
- Analyzed impact on FCP and CLS
- Documented three solution approaches

**Learnings:**
- `@import` for fonts is an anti-pattern in modern web development
- next/font provides significant performance benefits
- Font loading affects Core Web Vitals

### 2026-02-01 - Fix Applied

**By:** Claude Code

**Actions:**
- Created `src/lib/fonts.ts` with next/font configuration for Playfair Display and Source Sans 3
- Created server component wrapper `src/components/auth/AuthSplitLayout.tsx`
- Renamed original component to `AuthSplitLayoutClient.tsx`
- Removed `@import` styled-jsx block from client component
- Updated font-family to use CSS variables from next/font
- Verified TypeScript compilation passes

**Changes:**
- `src/lib/fonts.ts` - Created (new file)
- `src/components/auth/AuthSplitLayout.tsx` - Rewritten as server component wrapper
- `src/components/auth/AuthSplitLayoutClient.tsx` - Renamed and cleaned up

**Result:** Fonts now load with `display: 'swap'` and are optimized by Next.js
