---
status: pending
priority: p2
issue_id: "007"
tags: [yagni, simplification, architecture]
dependencies: []
---

# Simplify Brand Configuration - Remove Unused Brands

## Problem Statement

The brand configuration defines 6 brands (TEAM_BRAND, INDIVIDUAL_BRAND, COUPLES_BRAND, FAMILY_BRAND, EXTENSION_BRAND, PHOTOSHOTSPRO_BRAND) but only 3 are actively used (TeamShotsPro, PhotoShotsPro, and RightClickFit). This violates YAGNI principle and creates unnecessary complexity.

## Findings

**Unused brand configurations:**
- `INDIVIDUAL_BRAND` (IndividualShots) - Not actively used
- `COUPLES_BRAND` (CoupleShots) - Not actively used
- `FAMILY_BRAND` (FamilyShots) - Not actively used

**Active brands (KEEP):**
- `TEAM_BRAND` (TeamShotsPro)
- `EXTENSION_BRAND` (RightClickFit)
- `PHOTOSHOTSPRO_BRAND` (PhotoShotsPro)

**Unused interfaces:**
- `BrandTypography` - All brands use same fonts
- `BrandStyle` - Never consumed in components

**Unused functions:**
- `getBrandTypography()` - Never called
- `getBrandStyle()` - Never called

**Unused configs:**
- `TYPOGRAPHY_CONFIGS` - All identical
- `STYLE_CONFIGS` - Never used

**Impact:**
- ~207 lines of unnecessary code
- Maintenance burden for unused features
- Confusing for developers ("which brands are real?")
- Increases bundle size slightly

## Proposed Solutions

### Option 1: Remove All Unused Brands and Interfaces (Recommended)

**Approach**: Delete unused brand configs, interfaces, and functions. Keep only TEAM_BRAND and PHOTOSHOTSPRO_BRAND.

**Pros:**
- Significant code reduction (~207 lines)
- Clearer codebase
- Easier maintenance
- Follows YAGNI

**Cons:**
- If unused brands are needed later, they'll need to be recreated

**Effort:** 1 hour

**Risk:** Low

---

### Option 2: Comment/Deprecate Instead of Delete

**Approach**: Comment out unused brands with notes about future use.

**Pros:**
- Easy to restore if needed
- Documents what was considered

**Cons:**
- Clutters codebase
- Still requires maintenance

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

Implement Option 1: Remove all unused brands, interfaces, and functions. The code is in git history if needed later.

**Files to clean up:**
- Remove: `BrandTypography` interface
- Remove: `BrandStyle` interface
- Remove: `TYPOGRAPHY_CONFIGS`
- Remove: `STYLE_CONFIGS`
- Remove: `INDIVIDUAL_BRAND`, `COUPLES_BRAND`, `FAMILY_BRAND` (keep EXTENSION_BRAND/RightClickFit)
- Remove: `getBrandTypography()`, `getBrandStyle()`

## Technical Details

**Affected files:**
- `src/config/brand.ts` (major cleanup)

**Estimated LOC reduction:** ~207 lines

## Resources

- **Simplicity Review**: Code Simplicity Reviewer identified as YAGNI violation
- **Git History**: Unused brands were added speculatively

## Acceptance Criteria

- [ ] Unused brand configs removed
- [ ] Unused interfaces removed
- [ ] Unused functions removed
- [ ] Unused style/typography configs removed
- [ ] TypeScript compilation passes
- [ ] Only TEAM_BRAND, EXTENSION_BRAND, and PHOTOSHOTSPRO_BRAND remain
- [ ] All existing functionality preserved

## Work Log

### 2026-02-01 - Initial Discovery

**By:** Claude Code (Code Simplicity Reviewer)

**Actions:**
- Identified 4 unused brand configurations
- Cataloged unused interfaces and functions
- Calculated ~207 lines of removable code

**Learnings:**
- YAGNI violations accumulate over time
- Speculative features create maintenance burden
- Git history preserves deleted code if needed
