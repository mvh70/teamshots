# Invite Dashboard Priority Changes

**Date:** January 2025  
**Status:** Design Updated

---

## Key Design Change

**Primary Goal:** Get users to generate photos as quickly as possible.

**Critical Principle:** Selfies are part of the generation process, NOT a separate concern.

---

## What Changed

### 1. Hero Generate Button (PRIMARY FOCUS)

**Before:** Primary action card - prominent but not dominant

**After:** Massive, impossible-to-miss hero button
- Takes center stage on the page
- 80px icon, large text (20px)
- Generous padding (64px vertical, 48px horizontal)
- Brand-cta color (orange) - maximum visibility
- Full width on mobile, max-width 600px centered on desktop
- Large shadow for depth
- **This is THE primary action - make it unmissable**

**When clicked:** Opens inline generation flow (selfie upload integrated)

---

### 2. Integrated Generation Flow

**Before:** Separate selfies page → separate generation flow

**After:** Single, integrated inline flow
- Selfie upload is part of generation, not separate
- All steps happen inline (no page navigation)
- Generate button always visible and prominent
- Auto-advance when 2+ selfies uploaded
- Focus on speed - minimize clicks

**Flow Steps:**
1. Upload selfies (inline, part of flow)
2. Select selfies (if multiple uploaded)
3. Style selection (quick, minimal, if allowed)
4. Generate (large, prominent button)

---

### 3. Selfies Page (De-emphasized)

**Before:** Primary navigation, separate page for selfie management

**After:** 
- Hidden from primary navigation
- Only for advanced selfie management (deletion, etc.)
- NOT part of the primary user flow
- Upload and selection happen inline during generation

**If separate page exists:**
- Only accessible via direct URL or "Manage selfies" link (secondary)
- Used only for deletion/viewing all selfies
- Low priority in implementation

---

### 4. Recent Photos Gallery (Secondary)

**Before:** Prominent gallery, empty state shown

**After:**
- Compact, secondary (not dominant)
- Only shown if user has generated photos
- Hidden if no photos (don't show empty state)
- Positioned below primary CTA (not competing for attention)
- Max 4 thumbnails, then "View all" link

---

### 5. Dashboard Layout Priority

**New Priority Order:**
1. **Hero Generate Button** (massive, prominent, primary CTA)
2. Welcome Section (personalized greeting)
3. Credit Status (minimal, not dominant)
4. Recent Photos Gallery (compact, secondary, only if photos exist)
5. Signup CTA (bottom, subtle)

**Removed/De-emphasized:**
- ❌ Separate selfies page navigation
- ❌ Selfie management interface (part of flow)
- ❌ Dominant stats cards (minimal, don't distract)
- ❌ Empty states for galleries (just show generate button)

---

## Implementation Priority

### Phase 1: Hero Generate Button & Integrated Flow (HIGHEST PRIORITY)

**Tasks:**
1. Create massive, prominent generate button component
2. Build inline generation flow (selfie upload integrated)
3. Make generate button always visible throughout flow
4. Add auto-advance logic (when 2+ selfies uploaded)
5. Integrate selfie selection inline (not separate page)

**Deliverables:**
- Hero generate button component
- Inline generation flow component
- Integrated selfie upload/selection
- Auto-advance logic

---

### Phase 2: Dashboard Integration (HIGH PRIORITY)

**Tasks:**
1. Integrate hero button into main dashboard
2. Make it the primary, unmissable CTA
3. Position recent photos gallery below (secondary)
4. Minimize other elements (don't distract from CTA)

---

### Phase 3: Selfies Page (LOW PRIORITY)

**Tasks:**
1. Hide from primary navigation
2. Make it secondary/advanced only
3. Focus on deletion/management only
4. NOT part of primary flow

**Note:** This is LOW PRIORITY - focus on integrated flow first

---

## Visual Specifications

### Hero Generate Button

**Dimensions:**
- Padding: 64px vertical, 48px horizontal (desktop)
- Full width on mobile
- Max-width 600px centered on desktop
- Border radius: 16px (more rounded, friendly)

**Typography:**
- Title: 24px, font-weight: 700, white
- Description: 16px, font-weight: 400, white (opacity: 0.95)
- Button text: 20px, font-weight: 600, white

**Colors:**
- Background: brand-cta (#EA580C)
- Hover: brand-cta-hover (#C2410C)
- Shadow: Large, prominent shadow-lg

**Icon:**
- Size: 80px × 80px
- Color: White
- Position: Top center

**States:**
- Enabled: Full brand-cta color, white text, prominent shadow
- Disabled: Gray background, muted text, explanation below
- Loading: Spinner, "Generating..." text

---

### Inline Generation Flow

**Layout:**
- Modal/panel overlay (not full page navigation)
- Progress indicator: Simple dots (4 steps)
- Generate button: Always visible at bottom (sticky if needed)
- Selfie upload: Large drop zone (min-height: 300px)
- Auto-advance: When 2+ selfies uploaded and selected

**Steps:**
1. Upload & Select Selfies (combined step)
2. Style Selection (quick, minimal)
3. Review & Confirm (summary, cost)
4. Generate (progress bar)

---

## User Experience Goals

### Speed Metrics
- **Time to first generation**: < 2 minutes from landing (target)
- **Clicks to generate**: Minimum possible (target: 3-4 clicks)
- **Selfie upload**: Inline, part of flow (not separate page)
- **Generate button**: Always visible, always prominent

### Flow Clarity
- **Primary action**: Generate photos (unmissable)
- **Secondary actions**: View photos, manage selfies (subtle)
- **No distractions**: Minimize everything except generate button
- **Clear path**: Upload → Select → Style → Generate

---

## Content Updates

### Generate Button Copy

**Primary:**
- "Generate Your Team Photos"
- "Upload your selfies and create professional headshots in under 60 seconds"

**Secondary (if has photos):**
- "Generate More Photos"
- "Create additional team photos"

### Flow Copy

**Step 1:**
- "Upload 2 or more selfies to generate your team photos"
- "Drag and drop your selfies here or click to browse"

**Generate Button (in flow):**
- "Generate Photos" (always visible)
- Shows: "4 credits • 16 remaining (4 photos)"

---

## References

- [Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md) - Updated main design
- [Invite Dashboard Pages Redesign](./INVITE_DASHBOARD_PAGES_REDESIGN.md) - Updated pages design
- [Brand Config](../src/config/brand.ts) - Color references

---

**Status:** Design documents updated. Ready for implementation with new priority focus.

