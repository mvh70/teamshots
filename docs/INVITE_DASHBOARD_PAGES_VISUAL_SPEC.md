# Invite Dashboard Pages Visual Layout Specification

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase  
**Companion Documents:** 
- [Invite Dashboard Pages Redesign](./INVITE_DASHBOARD_PAGES_REDESIGN.md)
- [Invite Dashboard Visual Spec](./INVITE_DASHBOARD_VISUAL_SPEC.md)

---

## 1. Selfies Page Visual Layout

### Desktop Layout (1280px+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Header (Sticky)                                                      │ │
│  │  [Team Name]                    Credits: 20 (5 photos)             │ │
│  │  ← Back to Dashboard                                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Your Selfies                                                        │ │
│  │  Select 2 or more selfies to generate your team photos              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  ✓ Selected: 2 selfies                                              │ │
│  │  [Continue to Style Selection →]                                      │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Selfie Gallery                                                       │ │
│  │                                                                       │ │
│  │  [Selfie] [Selfie] [Selfie] [+ Upload]                              │ │
│  │   ✓        ✓        ☐                                                 │ │
│  │                                                                       │ │
│  │  [Selfie] [Selfie] [Selfie]                                          │ │
│  │   ☐        ☐        ☐                                                 │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Dimensions

#### Page Header
- Padding: 32px vertical, 0 horizontal
- Title: 32px, font-weight: 700, color: text-dark
- Subtitle: 16px, font-weight: 400, color: text-muted
- Gap: 8px between title and subtitle

#### Selection Info Banner
- Background: brand-primary-light (#EEF2FF)
- Border: 1px solid brand-primary-light
- Padding: 16px vertical, 24px horizontal
- Border radius: 12px
- Typography: 14px status, 16px button
- Button: brand-primary background, white text, 12px 24px padding

#### Selfie Gallery Grid
- Columns: 3 (desktop), 2 (tablet), 2 (mobile)
- Gap: 16px (desktop), 12px (mobile)
- Aspect ratio: 1:1 (square)
- Border radius: 12px
- Selected: 4px solid brand-secondary, ring-offset-2

#### Selfie Card
- Border: 2px solid transparent (default)
- Selected: 4px solid brand-secondary
- Hover: Scale 1.02, shadow-md
- Transition: 200ms ease-out

#### Selection Checkbox
- Size: 44px × 44px (mobile), 32px × 32px (desktop)
- Position: Top-left corner
- Background: White (unselected), brand-secondary (selected)
- Border: 2px solid gray-300 (unselected), brand-secondary (selected)

#### Upload Tile
- Border: 2px dashed gray-300
- Background: White
- Hover: border-brand-primary, text-brand-primary
- Icon: CameraIcon, 48px
- Text: "Upload new selfie"

---

## 2. Generations Page Visual Layout

### Desktop Layout (1280px+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Header (Sticky)                                                      │ │
│  │  [Team Name]                    Credits: 20 (5 photos)             │ │
│  │  ← Back to Dashboard                                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Your Generated Photos                                               │ │
│  │  Professional team photos ready to download                          │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Generation Grid                                                     │ │
│  │                                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │ Generation   │  │ Generation   │  │ Generation   │              │ │
│  │  │ Card         │  │ Card         │  │ Card         │              │ │
│  │  │              │  │              │  │              │              │ │
│  │  │ [Before]     │  │ [Before]     │  │ [Before]     │              │ │
│  │  │ [After]      │  │ [After]      │  │ [After]      │              │ │
│  │  │              │  │              │  │              │              │ │
│  │  │ [Actions]    │  │ [Actions]    │  │ [Actions]    │              │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │ │
│  │                                                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐                                │ │
│  │  │ Generation   │  │ Generation   │                                │ │
│  │  │ Card         │  │ Card         │                                │ │
│  │  └──────────────┘  └──────────────┘                                │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Generation Card Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Generation Card                                                     │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  ┌──────────────────┐  ┌──────────────────┐                      │ │
│  │                  │  │                  │                      │ │
│  │   Before         │  │   After          │                      │ │
│  │   (Selfie)       │  │   (Generated)    │                      │ │
│  │                  │  │                  │                      │ │
│  │  [Image]         │  │  [Image]         │                      │ │
│  │                  │  │                  │                      │ │
│  └──────────────────┘  └──────────────────┘                      │ │
│                                                                     │ │
│  [Slider: ←───────────●──────────→]                                │ │
│                                                                     │ │
│  Status: Completed • 2 hours ago                                    │ │
│                                                                     │ │
│  [Download] [Regenerate]                                           │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Dimensions

#### Page Header
- Padding: 32px vertical, 0 horizontal
- Title: 32px, font-weight: 700, color: text-dark
- Subtitle: 16px, font-weight: 400, color: text-muted
- Gap: 8px between title and subtitle

#### Generation Card
- Width: 100% (responsive grid)
- Min-height: 400px
- Padding: 24px
- Border radius: 12px
- Background: White
- Border: 1px solid gray-200
- Shadow: shadow-sm
- Hover: shadow-md, scale 1.01

#### Image Comparison
- Layout: Side-by-side (desktop), stacked (mobile)
- Aspect ratio: 4:5 (portrait)
- Border radius: 8px
- Labels: "Before" and "After" (12px, text-muted)

#### Slider
- Width: 100%
- Height: 4px
- Background: gray-200
- Thumb: brand-primary, 16px × 16px

#### Action Buttons
- Layout: Horizontal row
- Spacing: 12px gap
- Download: brand-primary background, white text
- Regenerate: Gray border, text-gray-700

#### Generation Grid
- Columns: 3 (desktop), 2 (tablet), 1 (mobile)
- Gap: 24px (desktop), 16px (mobile)

---

## 3. Generate Flow Visual Layout

### Desktop Layout (1280px+)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Header (Sticky)                                                      │ │
│  │  [Team Name]                    Credits: 20 (5 photos)             │ │
│  │  ← Back to Dashboard                                                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Progress Indicator                                                  │ │
│  │  [●─────○─────○─────○] Step 1 of 4: Select Selfies                │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Step Content                                                        │ │
│  │  (Changes based on current step)                                    │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │  Navigation                                                          │ │
│  │  [← Back]                                    [Continue →]           │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Select Selfies

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Select Selfies                                        │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Select 2 or more selfies to generate your team photos             │ │
│                                                                     │ │
│  ✓ Selected: 2 selfies                                             │ │
│                                                                     │ │
│  [Selfie] [Selfie] [Selfie] [+ Upload]                            │ │
│   ✓        ✓        ☐                                               │ │
│                                                                     │ │
│  [← Back]                                    [Continue →]           │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Title: 24px, font-weight: 600
- Description: 16px, text-muted
- Selection banner: brand-primary-light background, 16px padding
- Gallery: Same as selfies page
- Navigation: Bottom-aligned, 24px padding

---

### Step 2: Customize Style

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 2 of 4: Customize Style                                       │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Customize your photo style (optional)                              │ │
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
│  Selected: 2 selfies • Style: Corporate                            │ │
│                                                                     │ │
│  [← Back]                                    [Continue →]           │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Accordion header: 48px height, brand-primary-light background
- Accordion content: 24px padding
- Preview thumbnails: 80px × 80px
- Summary: 14px, text-muted

---

### Step 3: Review & Confirm

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 3 of 4: Review & Confirm                                      │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Review your selections before generating                           │ │
│                                                                     │ │
│  ┌──────────────────┐  ┌──────────────────┐                      │ │
│  │  Selected Selfies │  │  Style Preview    │                      │ │
│  │                   │  │                   │                      │ │
│  │  [Selfie] [Selfie]│  │  [Preview Image]  │                      │ │
│  │                   │  │                   │                      │ │
│  └──────────────────┘  └──────────────────┘                      │ │
│                                                                     │ │
│  Summary:                                                            │ │
│  • 2 selfies selected                                               │ │
│  • Style: Corporate                                                 │ │
│  • Cost: 4 credits                                                  │ │
│  • Remaining: 16 credits (4 photos)                                │ │
│                                                                     │ │
│  [← Back]                                    [Generate →]           │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Two-column layout (desktop), stacked (mobile)
- Summary card: brand-primary-light background, 24px padding
- Cost display: 24px, font-weight: 700
- Generate button: brand-cta color, large size (16px padding)

---

### Step 4: Generate

```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Generating Photos                                    │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Your photos are being generated...                                 │ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  [Progress Bar: 45%]                                          │ │ │
│  │  Generating your photos... (45%)                              │ │ │
│  │  Estimated time: 30 seconds                                    │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
│  This usually takes 30-60 seconds. Please don't close this page.   │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Progress bar: brand-primary color, 8px height
- Status text: 16px, text-body
- Estimated time: 14px, text-muted
- Warning: Orange background, subtle

---

### Progress Indicator

```
┌─────────────────────────────────────────────────────────────────────┐
│  [●─────○─────○─────○] Step 1 of 4: Select Selfies                │
└─────────────────────────────────────────────────────────────────────┘
```

**Dimensions:**
- Height: 48px
- Background: gray-50
- Padding: 16px horizontal
- Border-bottom: 1px solid gray-200

**Steps:**
- Completed: brand-secondary color, filled circle (12px)
- Active: brand-primary color, filled circle (12px)
- Pending: gray-300 color, empty circle (12px)
- Connector: Gray line (2px) between steps

---

## Mobile Layouts (< 768px)

### Selfies Page Mobile

```
┌─────────────────────────────────────┐
│  Header (Compact)                   │
│  [Team Name]     20 credits (5 photos)│
│  ← Back                              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Your Selfies                       │
│  Select 2 or more selfies           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [Selfie] [Selfie]                  │
│   ✓        ✓                         │
│                                      │
│  [Selfie] [+ Upload]                │
│   ☐                                   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  ✓ Selected: 2 selfies              │
│  [Continue →]                       │
└─────────────────────────────────────┘
```

**Key Adaptations:**
- 2-column grid
- Stacked selection banner (below gallery)
- Larger touch targets (44px minimum)
- Compact header

---

### Generations Page Mobile

```
┌─────────────────────────────────────┐
│  Header (Compact)                   │
│  [Team Name]     20 credits (5 photos)│
│  ← Back                              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Your Generated Photos              │
│  Professional team photos           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Generation Card                    │
│                                     │
│  [Before Image]                     │
│                                     │
│  [After Image]                      │
│                                     │
│  [Slider]                           │
│                                     │
│  Status: Completed                  │
│                                     │
│  [Download] [Regenerate]            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Generation Card                    │
│  (Same layout)                      │
└─────────────────────────────────────┘
```

**Key Adaptations:**
- Single column layout
- Stacked before/after images
- Full-width cards
- Larger touch targets

---

### Generate Flow Mobile

```
┌─────────────────────────────────────┐
│  Header (Compact)                   │
│  [Team Name]     20 credits (5 photos)│
│  ← Back                              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Step 1 of 4                        │
│  Select Selfies                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Select 2 or more selfies           │
│                                     │
│  ✓ Selected: 2 selfies              │
│                                     │
│  [Selfie] [Selfie] [+ Upload]      │
│   ✓        ✓                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  [← Back]        [Continue →]       │
└─────────────────────────────────────┘
```

**Key Adaptations:**
- Compact progress indicator (text only)
- Full-width steps
- Stacked layouts
- Sticky navigation buttons
- Larger touch targets

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
- Normal: 300ms (hover states, step transitions)
- Slow: 600ms (page loads, step changes)

**Easing:**
- Default: `ease-out`
- Hover: `ease-in-out`
- Step transitions: `ease-in-out`

### Key Animations

1. **Step Transition**: Slide left/right (300ms)
2. **Card Hover**: Scale 1.02 + shadow (200ms)
3. **Button Click**: Scale 0.98 (100ms)
4. **Progress Bar**: Smooth width transition (per update)
5. **Selection**: Checkmark animation (200ms)

### Implementation

```css
/* Example: Step transition */
.step-content {
  transition: transform 300ms ease-in-out, opacity 300ms ease-in-out;
}

.step-enter {
  transform: translateX(20px);
  opacity: 0;
}

.step-enter-active {
  transform: translateX(0);
  opacity: 1;
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

- ✅ Semantic HTML elements
- ✅ ARIA labels where needed
- ✅ Alt text for images
- ✅ Status announcements for dynamic content
- ✅ Progress announcements for generation

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
- Larger touch targets

**Tablet (768px - 1024px):**
- 2-column grid for galleries
- Side-by-side where appropriate

**Desktop (> 1024px):**
- 3-column grid for galleries
- Side-by-side content sections
- Sticky header
- Hover states

---

## Implementation Notes

### Component Structure

```
src/components/invite-dashboard/
  ├── pages/
  │   ├── SelfiesPage.tsx
  │   ├── GenerationsPage.tsx
  │   └── GenerateFlow.tsx
  ├── components/
  │   ├── SelfieGallery.tsx
  │   ├── SelectionBanner.tsx
  │   ├── GenerationCard.tsx
  │   ├── BeforeAfterSlider.tsx
  │   ├── StepProgress.tsx
  │   ├── StyleSelection.tsx
  │   └── GenerationProgress.tsx
  └── shared/
      ├── PageHeader.tsx
      └── NavigationButtons.tsx
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

