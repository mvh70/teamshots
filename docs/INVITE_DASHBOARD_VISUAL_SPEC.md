# Invite Dashboard Visual Layout Specification

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase  
**Companion Document:** [Invite Dashboard Redesign Plan](./INVITE_DASHBOARD_REDESIGN.md)

---

## Layout Overview

### Desktop Layout (1280px+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Header (Sticky)                                                      │ │
│  │  [Team Name]                    Credits: 20 (5 photos)              │ │
│  │  Welcome back, Sarah                                                 │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Welcome Section (Gradient Background)                                 │ │
│  │                                                                         │ │
│  │  Welcome to Acme Corp, Sarah! 🎉                                      │ │
│  │  Upload your selfie and generate your professional team photo           │ │
│  │  in under 60 seconds.                                                  │ │
│  │                                                                         │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                    │
│  │ 💎 Credits   │  │ 📸 Photos    │  │ 📷 Selfies    │                    │
│  │              │  │              │  │              │                    │
│  │  20          │  │  0           │  │  0            │                    │
│  │  credits     │  │  generated   │  │  uploaded    │                    │
│  │              │  │              │  │              │                    │
│  │  Good for    │  │              │  │              │                    │
│  │  5 photos    │  │              │  │              │                    │
│  └──────────────┘  └──────────────┘  └──────────────┘                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Primary Action Card                                                  │ │
│  │                                                                       │ │
│  │         [📸 Large Icon]                                              │ │
│  │                                                                       │ │
│  │    Generate Your Team Photos                                          │ │
│  │                                                                       │ │
│  │    Upload selfies and create professional headshots                    │ │
│  │                                                                       │ │
│  │    [Start →]                                                          │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Recent Photos                    [View all →]                         │ │
│  ├───────────────────────────────────────────────────────────────────────┤ │
│  │                                                                       │ │
│  │  [Empty State]                                                       │ │
│  │                                                                       │ │
│  │  📷 No photos yet                                                    │ │
│  │  Generate your first team photos                                      │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Signup CTA Card                                                      │ │
│  │                                                                       │ │
│  │  Create an account                                                    │ │
│  │                                                                       │ │
│  │  Save your photos, track your history, and manage your profile       │ │
│  │                                                                       │ │
│  │  [Sign up →]                                                          │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### 1. Header Component

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Acme Corp                    Credits: 20 (good for 5 photos)     │
│  Welcome back, Sarah                                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Mobile Layout:**
```
┌─────────────────────────────────────┐
│  Acme Corp          20 credits      │
│                      (5 photos)     │
└─────────────────────────────────────┘
```

**Dimensions:**
- Height: 80px (desktop), 60px (mobile)
- Padding: 16px vertical, 24px horizontal (desktop)
- Background: White (#FFFFFF)
- Border: 1px solid #E5E7EB (bottom only)

**Typography:**
- Team Name: 18px, font-weight: 600, color: text-dark
- Credits: 16px, font-weight: 700, color: brand-primary
- Subtitle: 14px, font-weight: 400, color: text-muted

**Spacing:**
- Gap between elements: 16px
- Mobile: Stacked layout, reduced padding

---

### 2. Welcome Section

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                                                     │
│  Welcome to Acme Corp, Sarah! 🎉                                   │
│                                                                     │
│  Upload your selfie and generate your professional team photo       │
│  in under 60 seconds.                                               │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Height: Auto (min-height: 160px)
- Padding: 48px vertical, 32px horizontal (desktop)
- Border radius: 12px (rounded-xl)
- Background: Gradient (from-brand-primary to-brand-primary-hover)

**Typography:**
- Title: 32px (desktop), 28px (mobile), font-weight: 700, color: white
- Subtitle: 18px (desktop), 16px (mobile), font-weight: 400, color: white (opacity: 0.95)
- Line height: 1.3 (title), 1.6 (subtitle)

**Spacing:**
- Title margin-bottom: 12px
- Content padding: 32px

**Visual Effects:**
- Gradient background: `bg-gradient-to-r from-brand-primary to-brand-primary-hover`
- Subtle shadow: `shadow-lg`
- Optional: Grain texture overlay (10% opacity)

---

### 3. Stats Cards Grid

**Layout:**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  💎 Credits  │  │  📸 Photos   │  │  📷 Selfies  │
│              │  │              │  │              │
│  20          │  │  0           │  │  0           │
│  credits     │  │  generated   │  │  uploaded    │
│              │  │              │  │              │
│  Good for    │  │              │  │              │
│  5 photos    │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Card Dimensions:**
- Width: 100% (responsive grid)
- Min-height: 160px
- Padding: 24px
- Border radius: 12px (rounded-xl)
- Background: White (#FFFFFF)
- Border: 1px solid #E5E7EB (gray-200)
- Shadow: `shadow-sm`
- Hover: `shadow-md`, scale 1.02

**Icon Container:**
- Size: 48px × 48px
- Background: brand-primary-light (#EEF2FF)
- Border radius: 10px
- Icon: 24px, brand-primary color
- Margin-bottom: 16px

**Typography:**
- Label: 14px, font-weight: 500, color: text-muted
- Value: 32px, font-weight: 700, color: text-dark
- Unit: 14px, font-weight: 400, color: text-muted
- Change: 12px, font-weight: 400, color: brand-secondary

**Spacing:**
- Grid gap: 24px (desktop), 16px (mobile)
- Card padding: 24px
- Icon to label: 16px
- Label to value: 8px

**Responsive:**
- Desktop: 3 columns
- Tablet: 2 columns
- Mobile: 1 column (stacked)

---

### 4. Primary Action Card

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                                                     │
│                    [📸 Large Icon - 64px]                          │
│                                                                     │
│              Generate Your Team Photos                              │
│                                                                     │
│         Upload selfies and create professional headshots           │
│                                                                     │
│                    [Start →]                                        │
│                                                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Width: 100%
- Min-height: 240px
- Padding: 48px vertical, 32px horizontal
- Border radius: 12px (rounded-xl)
- Background: brand-cta (#EA580C)
- Text color: White (#FFFFFF)

**Typography:**
- Title: 24px, font-weight: 700, color: white
- Description: 16px, font-weight: 400, color: white (opacity: 0.95)
- Button: 16px, font-weight: 600, color: white

**Icon:**
- Size: 64px × 64px
- Color: White
- Margin-bottom: 24px

**Button:**
- Padding: 16px 32px
- Border radius: 8px
- Background: White (20% opacity overlay)
- Hover: Background white (30% opacity)
- Border: 2px solid white

**Spacing:**
- Icon to title: 24px
- Title to description: 12px
- Description to button: 32px

**States:**
- **Enabled**: Full brand-cta color, white text
- **Disabled**: Gray background (#9CA3AF), muted text, explanation tooltip
- **Loading**: Spinner, disabled interaction

---

### 5. Recent Photos Gallery

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Recent Photos                    [View all →]                       │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  [Photo]  [Photo]  [Photo]  [Photo]                               │ │
│  120×120   120×120   120×120   120×120                              │ │
│                                                                     │ │
│  [Photo]  [Photo]  [Photo]  [Photo]                               │ │
│  120×120   120×120   120×120   120×120                              │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Card Dimensions:**
- Width: 100%
- Padding: 24px
- Border radius: 12px (rounded-xl)
- Background: White (#FFFFFF)
- Border: 1px solid #E5E7EB

**Gallery Grid:**
- Columns: 4 (desktop), 2 (mobile)
- Gap: 16px
- Thumbnail size: 120px × 120px (desktop), 80px × 80px (mobile)
- Border radius: 8px
- Aspect ratio: 1:1 (square)

**Thumbnail States:**
- Default: Border 1px solid #E5E7EB
- Hover: Scale 1.05, shadow-md, border brand-primary
- Selected: Border 2px solid brand-primary

**Empty State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    [📷 Icon - 48px]                                 │
│                                                                     │
│                    No photos yet                                    │
│                                                                     │
│         Generate your first team photos                             │
│                                                                     │
│                    [Generate →]                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Typography:**
- Title: 18px, font-weight: 600, color: text-dark
- Empty state title: 16px, font-weight: 600, color: text-dark
- Empty state description: 14px, font-weight: 400, color: text-muted
- "View all" link: 14px, font-weight: 500, color: brand-primary

---

### 6. Selfie Upload Flow

**Step 1: Upload**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Upload Selfie                                        │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │                                                               │ │ │
│  │              [📷 Camera Icon - 64px]                          │ │ │
│  │                                                               │ │ │
│  │         Drag and drop your selfie here                        │ │ │
│  │              or click to browse                                │ │ │
│  │                                                               │ │ │
│  │                    [Choose File]                               │ │ │
│  │                                                               │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Step 2: Select (2+ Required)**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2 of 4: Select Selfies (2+ required)                        │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  ✓ Selected: 2 selfies                                             │ │
│                                                                     │ │
│  [Selfie] [Selfie] [Selfie] [Selfie]                              │ │
│   ✓        ✓        ☐        ☐                                      │ │
│                                                                     │ │
│  [+ Upload More]                                    [Continue →]    │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Step 3: Style Selection**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3 of 4: Customize Style                                       │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  Background                    [▼]                            │ │ │
│  │  Office                        [Preview]                      │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  Style Preset                 [▼]                            │ │ │
│  │  Corporate                    [Preview]                      │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
│  [← Back]                                    [Generate →]          │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Step 4: Generate**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Generate Photos                                       │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Selected: 2 selfies                                               │ │
│  Style: Corporate                                                   │ │
│  Cost: 4 credits                                                    │ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  [Progress Bar: 45%]                                          │ │ │
│  │  Generating your photos... (45%)                              │ │ │
│  │  Estimated time: 30 seconds                                    │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Progress Indicator:**
- Height: 48px
- Background: brand-primary-light
- Active: brand-primary
- Border radius: 8px
- Animation: Smooth width transition

---

### 7. Signup CTA Card

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Create an account                                                  │
│                                                                     │
│  Save your photos, track your history, and manage your profile     │
│                                                                     │
│  [Sign up →]                                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Width: 100%
- Padding: 24px
- Border radius: 12px (rounded-xl)
- Background: brand-primary-light (#EEF2FF)
- Border: 1px solid brand-primary-light

**Typography:**
- Title: 18px, font-weight: 600, color: text-dark
- Description: 14px, font-weight: 400, color: text-body
- Button: 14px, font-weight: 600, color: white

**Button:**
- Padding: 12px 24px
- Border radius: 8px
- Background: brand-cta (#EA580C)
- Hover: brand-cta-hover (#C2410C)

**Spacing:**
- Title margin-bottom: 8px
- Description margin-bottom: 16px

---

## Mobile Layout (< 768px)

### Stacked Layout

```
┌─────────────────────────────────────┐
│  Header (Compact)                   │
│  Acme Corp     20 credits (5 photos)│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Welcome Section                   │
│                                    │
│  Welcome to Acme Corp, Sarah! 🎉  │
│                                    │
│  Upload your selfie and generate  │
│  your professional team photo      │
│  in under 60 seconds.              │
│                                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  💎 Credits                        │
│  20 credits                        │
│  Good for 5 photos                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📸 Photos                         │
│  0 generated                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  📷 Selfies                        │
│  0 uploaded                        │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Primary Action Card               │
│                                    │
│  [📸 Icon]                         │
│                                    │
│  Generate Your Team Photos         │
│                                    │
│  Upload selfies and create         │
│  professional headshots            │
│                                    │
│  [Start →]                         │
│                                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Recent Photos                     │
│  [View all →]                      │
│                                    │
│  [Photo] [Photo]                  │
│  [Photo] [Photo]                  │
│                                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Signup CTA                        │
│                                    │
│  Create an account                 │
│                                    │
│  Save your photos, track your     │
│  history, and manage your profile  │
│                                    │
│  [Sign up →]                       │
│                                    │
└─────────────────────────────────────┘
```

**Key Mobile Adaptations:**
- Single column layout
- Reduced padding (16px instead of 24px)
- Stacked stats cards (full width)
- Full-width action buttons
- Compact header (single line)
- Larger touch targets (min 44px)
- Reduced font sizes (title: 28px instead of 32px)

---

## Color Usage Reference

### Brand Colors (from config)

**Primary:**
- `bg-brand-primary`: #6366F1 (Indigo-500)
- `bg-brand-primary-hover`: #4F46E5 (Indigo-600)
- `bg-brand-primary-light`: #EEF2FF (Indigo-50)
- `text-brand-primary`: #6366F1

**Secondary:**
- `bg-brand-secondary`: #10B981 (Green-500)
- `text-brand-secondary`: #10B981

**CTA:**
- `bg-brand-cta`: #EA580C (Orange-600)
- `bg-brand-cta-hover`: #C2410C (Orange-700)
- `bg-brand-cta-light`: #FFF7ED (Orange-50)
- `text-brand-cta`: #EA580C

**Neutrals:**
- `text-dark`: #111827
- `text-body`: #374151
- `text-muted`: #6B7280
- `bg-white`: #FFFFFF
- `bg-gray-50`: #F9FAFB

**Usage Rules:**
- ✅ Use Tailwind classes: `bg-brand-primary`, `text-brand-cta`
- ❌ Never hardcode: `style={{ color: '#6366F1' }}`
- ✅ Reference config: `BRAND_CONFIG.colors.primary` (programmatic only)

---

## Spacing Reference

### Base Unit: 4px

**Scale:**
- `xs`: 4px (0.25rem) - `p-1`, `gap-1`
- `sm`: 8px (0.5rem) - `p-2`, `gap-2`
- `md`: 16px (1rem) - `p-4`, `gap-4`
- `lg`: 24px (1.5rem) - `p-6`, `gap-6`
- `xl`: 32px (2rem) - `p-8`, `gap-8`
- `2xl`: 48px (3rem) - `p-12`, `gap-12`

**Component Spacing:**
- Card padding: `p-6` (24px)
- Section spacing: `space-y-8` (32px)
- Grid gaps: `gap-6` (24px)
- Element spacing: `gap-4` (16px)

---

## Typography Reference

### Font Stacks

**Display (Headings):**
```css
font-family: var(--font-display), 'Georgia', 'Times New Roman', serif;
```

**Body:**
```css
font-family: var(--font-body), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Type Scale

**Desktop:**
- H1: `text-3xl` (32px), `font-bold` (700)
- H2: `text-2xl` (24px), `font-semibold` (600)
- H3: `text-lg` (18px), `font-semibold` (600)
- Body Large: `text-base` (16px), `font-normal` (400)
- Body: `text-sm` (14px), `font-normal` (400)
- Small: `text-xs` (12px), `font-normal` (400)

**Mobile:**
- H1: `text-2xl` (28px)
- H2: `text-xl` (20px)
- H3: `text-base` (16px)
- Body: `text-sm` (14px)

### Line Heights

- Headings: `leading-tight` (1.2-1.3)
- Body: `leading-normal` (1.5-1.6)

---

## Animation Specifications

### Transitions

**Duration:**
- Fast: 150ms (button clicks)
- Normal: 300ms (hover states)
- Slow: 600ms (page loads)

**Easing:**
- Default: `ease-out`
- Hover: `ease-in-out`

### Key Animations

1. **Page Load**: Fade-in + slide-up (600ms)
2. **Card Hover**: Scale 1.02 + shadow increase (200ms)
3. **Button Click**: Scale 0.98 (100ms)
4. **Modal Open**: Fade-in + scale (300ms)
5. **Progress Bar**: Smooth width transition (per update)

### Implementation

```css
/* Example: Card hover */
.card {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}

.card:hover {
  transform: scale(1.02);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}
```

---

## Accessibility Checklist

### Color Contrast

- ✅ Text on white: Minimum 4.5:1
- ✅ Text on brand-primary: Verify contrast
- ✅ Text on brand-cta: Verify contrast
- ✅ Interactive elements: Clear focus states

### Keyboard Navigation

- ✅ All interactive elements keyboard accessible
- ✅ Logical tab order
- ✅ Skip links for main content
- ✅ Focus indicators visible (2px solid brand-primary)

### Screen Readers

- ✅ Semantic HTML elements (`<header>`, `<main>`, `<section>`)
- ✅ ARIA labels where needed
- ✅ Alt text for images
- ✅ Status announcements for dynamic content

### Touch Targets

- ✅ Minimum 44px × 44px
- ✅ Adequate spacing between targets (8px minimum)
- ✅ No overlapping interactive elements

---

## Responsive Breakpoints

### Breakpoints (Tailwind)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Layout Changes

**Mobile (< 768px):**
- Single column
- Stacked cards
- Compact header
- Full-width buttons

**Tablet (768px - 1024px):**
- 2-column grid for stats
- Side-by-side where appropriate

**Desktop (> 1024px):**
- 3-column grid for stats
- Side-by-side content sections
- Sticky header
- Hover states

---

## Implementation Notes

### Component Structure

```
src/components/invite-dashboard/
  ├── Header.tsx
  ├── WelcomeSection.tsx
  ├── CreditCard.tsx
  ├── StatsGrid.tsx
  ├── PrimaryActionCard.tsx
  ├── RecentPhotosGallery.tsx
  ├── SelfieUploadFlow/
  │   ├── UploadStep.tsx
  │   ├── SelectStep.tsx
  │   ├── StyleStep.tsx
  │   └── GenerateStep.tsx
  ├── StyleSelection.tsx
  ├── GenerationProgress.tsx
  └── SignupCTA.tsx
```

### Brand Color Usage

**✅ Correct:**
```tsx
<div className="bg-brand-primary text-white">
<button className="bg-brand-cta hover:bg-brand-cta-hover">
```

**❌ Incorrect:**
```tsx
<div style={{ backgroundColor: '#6366F1' }}>
<div className="bg-[#6366F1]">
```

### Responsive Classes

**Mobile-first:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
```

**Spacing:**
```tsx
<div className="p-4 md:p-6 lg:p-8">
```

---

**Next Steps:**
1. Review visual specifications
2. Create component mockups (Figma/Sketch)
3. Begin implementation following this spec
4. Test responsive breakpoints
5. Verify brand color usage

