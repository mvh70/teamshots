# Try-It-For-Free Package Implementation Plan

## Overview
Replace the paid "Try Once" package ($5) with a free "Try It For Free" package that:
- Is completely free (no payment required)
- Has fixed style settings (always includes TeamShotsPro logo)
- Redirects to signup when clicked
- Uses personal, funny-but-serious copy

## Key Changes

### 1. Package Configuration
- **Remove**: `tryOnce` from `src/config/pricing.ts`
- **Add**: `tryItForFree` as a free tier (0 credits initially, grants 10 credits on signup)
- **Update**: `PACKAGES_CONFIG` to include `tryitforfree` package

### 2. Style Package
- **Create**: `src/domain/style/packages/tryitforfree/index.ts`
- **Fixed Settings**:
  - Branding: Always `include` with TeamShotsPro logo (not user-configurable)
  - Background: User can choose (visible category)
  - Other settings: Similar to freepackage but branding is locked
- **Visible Categories**: `['background', 'pose', 'clothing', 'clothingColors', 'expression']` (NO branding)

### 3. UI Components
- **PricingCard**: Update to handle `tryItForFree` plan ID
- **PricingPreview**: Replace try-once with try-it-for-free, link to `/auth/signup`
- **PricingContent**: Same updates
- **SubscriptionPanel**: Remove try-once handling
- **All pricing pages**: Update to show try-it-for-free

### 4. Copy Updates (Messages)
- **Tone**: Funny but serious, personal (talking directly to people)
- **Key Messages**:
  - Name: "Try It For Free" (not "Try Once")
  - Description: Personal, engaging copy about testing the service
  - CTA: "Sign up free" or "Get started free"
  - Features: Emphasize it's free, includes logo, perfect for testing

### 5. Signup Flow
- **Update**: `/auth/signup/page.tsx` to handle `tryItForFree` period param
- **Behavior**: When period=tryItForFree, grant 10 credits on signup completion
- **Package Assignment**: Assign `tryitforfree` package to new users

### 6. API Routes
- **Remove**: All try-once checkout handling from `/api/stripe/checkout/route.ts`
- **Remove**: Try-once webhook handling from `/api/stripe/webhook/route.ts`
- **Update**: Generation creation to handle try-it-for-free package

### 7. Database Schema
- **Note**: `planPeriod` enum includes `try_once` - we can keep it for backward compatibility or migrate
- **New Users**: Set `planPeriod: 'free'` and assign `tryitforfree` package

### 8. Brand Hardcoding Fixes
- **ColorPicker.tsx**: Replace hardcoded colors with brand config
- **CreditCostDisplay.tsx**: Replace hardcoded colors with brand config
- **Audit**: Check all components for hardcoded brand properties

## Implementation Order

1. ✅ Create plan document
2. Update pricing config
3. Create try-it-for-free package
4. Update UI components
5. Update copy (messages)
6. Update signup flow
7. Remove try-once API handling
8. Fix hardcoded brand colors
9. Final audit for brand hardcoding

## Testing Checklist

- [ ] Try-it-for-free card shows on pricing pages
- [ ] Clicking redirects to signup
- [ ] Signup grants 10 credits
- [ ] Branding is fixed to TeamShotsPro logo
- [ ] User cannot change branding in UI
- [ ] Copy is personal and engaging
- [ ] No hardcoded brand colors remain
- [ ] Spanish translations updated
- [ ] Old try-once references removed

## Rollback Plan

If issues arise:
1. Keep try-once code commented out (don't delete immediately)
2. Feature flag can be added to toggle between try-once and try-it-for-free
3. Database migration can be reversed if needed

