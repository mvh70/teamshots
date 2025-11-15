# Invite Dashboard Pages Redesign: Selfies, Generations & Generate Flow

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase  
**Companion Documents:** 
- [Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md)
- [Invite Dashboard Visual Spec](./INVITE_DASHBOARD_VISUAL_SPEC.md)

---

## Executive Summary

This document extends the invite dashboard redesign to cover three critical pages:
1. **Selfies Page** - Upload and manage selfies
2. **Generations Page** - View and manage generated photos
3. **Generate Flow** - Step-by-step photo generation process

All pages follow the same design principles: welcoming professionalism, brand consistency, and mobile-first responsive design.

---

## Design Philosophy

### Core Principles (Consistent Across All Pages)

- **Clarity First**: Every element guides users toward their goal
- **Visual Breathing Room**: Generous whitespace prevents cognitive overload
- **Purposeful Motion**: Subtle animations that guide attention
- **Brand Consistency**: All colors from brand config, no hardcoded values
- **Mobile-First**: Optimized for the most common access point
- **Accessibility**: WCAG 2.1 AA compliance throughout

---

## 1. Selfies Page Redesign

### ⚠️ IMPORTANT: Design Change

**The selfies page is NOT a separate concern.** Selfie upload and selection are integrated directly into the generation flow. Users should NOT need to navigate to a separate selfies page - it's all part of the inline generation process.

**If a separate selfies page exists, it should be:**
- Hidden from primary navigation
- Only accessible via direct URL or "Manage selfies" link (secondary)
- Used only for advanced selfie management (deletion, etc.)
- NOT part of the primary user flow

### Purpose (If Separate Page Exists)

The selfies page would only be for advanced selfie management (deletion, viewing all selfies). The primary flow integrates selfie upload into generation.

### User Goals (If Separate Page Exists)

1. View all uploaded selfies
2. Delete unused selfies
3. Return to generation flow

**Note:** Upload and selection happen inline during generation flow, not on this page.

### Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header (Sticky)                                                    │
│  [Team Name]                    Credits: 20 (5 photos)             │
│  ← Back to Dashboard                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Page Title                                                          │
│  Your Selfies                                                        │
│  Select 2 or more selfies to generate your team photos             │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Selection Info Banner                                               │
│  ✓ Selected: 2 selfies                                              │
│  [Continue to Style Selection →]                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Selfie Gallery                                                      │
│                                                                     │
│  [Selfie] [Selfie] [Selfie] [+ Upload]                            │
│   ✓        ✓        ☐                                               │
│                                                                     │
│  [Selfie] [Selfie] [Selfie]                                        │
│   ☐        ☐        ☐                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### Page Header Section

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Your Selfies                                                        │
│  Select 2 or more selfies to generate your team photos             │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Padding: 32px vertical, 0 horizontal (desktop)
- Typography: H1 (32px, bold), subtitle (16px, regular)
- Color: text-dark (title), text-muted (subtitle)
- Spacing: 8px between title and subtitle

**Mobile:**
- Padding: 24px vertical
- Typography: H1 (28px), subtitle (14px)

---

#### Selection Info Banner

**Purpose:** Show selection status and enable quick action

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ Selected: 2 selfies                                              │
│  [Continue to Style Selection →]                                    │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Background: brand-primary-light (#EEF2FF)
- Border: 1px solid brand-primary-light
- Padding: 16px vertical, 24px horizontal
- Border radius: 12px (rounded-xl)
- Typography: 14px, font-weight: 500 (status), 16px button text

**States:**
- **0 selected**: Hidden or disabled state
- **1 selected**: "Select 1 more selfie" (disabled button)
- **2+ selected**: "Selected: X selfies" (enabled button)

**Button:**
- Background: brand-primary (enabled) or gray-300 (disabled)
- Text: White (enabled) or gray-500 (disabled)
- Padding: 12px 24px
- Border radius: 8px
- Hover: brand-primary-hover

**Implementation Notes:**
- Sticky position (desktop) when scrolling
- Mobile: Full width, below gallery
- Smooth transitions between states

---

#### Selfie Gallery Grid

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Selfie] [Selfie] [Selfie] [+ Upload]                            │
│   ✓        ✓        ☐                                               │
│                                                                     │
│  [Selfie] [Selfie] [Selfie]                                        │
│   ☐        ☐        ☐                                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Grid Specifications:**
- Columns: 3 (desktop), 2 (tablet), 2 (mobile)
- Gap: 16px (desktop), 12px (mobile)
- Aspect ratio: 1:1 (square)
- Thumbnail size: Auto (responsive)

**Selfie Card:**
- Border radius: 12px (rounded-xl)
- Border: 2px solid transparent (default)
- Selected: 4px solid brand-secondary, ring-offset-2
- Hover: Scale 1.02, shadow-md
- Transition: 200ms ease-out

**Selection Checkbox:**
- Position: Top-left corner
- Size: 44px × 44px (mobile), 32px × 32px (desktop)
- Background: White (unselected), brand-secondary (selected)
- Border: 2px solid gray-300 (unselected), brand-secondary (selected)
- Icon: Checkmark (selected), empty square (unselected)
- Shadow: shadow-sm

**Delete Button:**
- Position: Top-right corner
- Size: 32px × 32px
- Background: Red-500 (on hover)
- Icon: TrashIcon, 16px
- Opacity: 0 (default), 100 (on hover/group-hover)
- Disabled: Gray-300 (if selfie is used in generation)

**Upload Tile:**
- Border: 2px dashed gray-300
- Background: White
- Hover: border-brand-primary, text-brand-primary
- Icon: CameraIcon, 48px
- Text: "Upload new selfie"
- Transition: 200ms ease-out

**Empty State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    [📷 Camera Icon - 64px]                          │
│                                                                     │
│                    No selfies yet                                   │
│                                                                     │
│         Upload your first selfie to get started                    │
│                                                                     │
│                    [Upload Selfie →]                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Padding: 64px vertical, 32px horizontal
- Typography: Title (18px, semibold), description (14px, regular)
- Button: brand-primary background, white text

---

#### Upload Flow Component

**Purpose:** Inline upload interface for adding new selfies

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Upload Selfie                                                      │
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

**Visual Specs:**
- Background: White
- Border: 1px solid gray-200
- Border radius: 12px
- Padding: 48px vertical, 32px horizontal
- Drop zone: Min-height 200px
- Border: 2px dashed gray-300 (default), brand-primary (on drag-over)

**States:**
- **Default**: Dashed border, camera icon, "Choose File" button
- **Drag Over**: Solid border-brand-primary, background brand-primary-light
- **Uploading**: Spinner, disabled state
- **Success**: Checkmark, "Selfie uploaded!" message

**Mobile:**
- Full-width drop zone
- Camera access button prominent
- File picker fallback

---

### Responsive Design

**Mobile (< 768px):**
- 2-column grid
- Larger touch targets (44px minimum)
- Stacked selection banner (below gallery)
- Full-width upload interface
- Compact header

**Tablet (768px - 1024px):**
- 3-column grid
- Side-by-side selection banner
- Standard upload interface

**Desktop (> 1024px):**
- 3-column grid
- Sticky selection banner
- Enhanced hover states
- Larger thumbnails

---

## 2. Generations Page Redesign

### Purpose

The generations page displays all generated photos for the team member. It shows before/after comparisons, allows regeneration, and enables downloads.

### User Goals

1. View all generated photos
2. Compare before/after (selfie vs generated)
3. Download photos
4. Regenerate photos (if credits available)
5. Navigate back to dashboard

### Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header (Sticky)                                                    │
│  [Team Name]                    Credits: 20 (5 photos)             │
│  ← Back to Dashboard                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Page Title                                                          │
│  Your Generated Photos                                               │
│  Professional team photos ready to download                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Generation Grid                                                     │
│                                                                     │
│  [Generation Card] [Generation Card] [Generation Card]            │
│                                                                     │
│  [Generation Card] [Generation Card]                               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### Page Header Section

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Your Generated Photos                                              │
│  Professional team photos ready to download                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Padding: 32px vertical, 0 horizontal (desktop)
- Typography: H1 (32px, bold), subtitle (16px, regular)
- Color: text-dark (title), text-muted (subtitle)
- Spacing: 8px between title and subtitle

**Mobile:**
- Padding: 24px vertical
- Typography: H1 (28px), subtitle (14px)

---

#### Generation Card

**Purpose:** Display before/after comparison with actions

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Generation Card                                                     │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  ┌──────────────────┐  ┌──────────────────┐                        │ │
│  │                  │  │                  │                        │ │
│  │   Before         │  │   After          │                        │ │
│  │   (Selfie)       │  │   (Generated)    │                        │ │
│  │                  │  │                  │                        │ │
│  │  [Image]         │  │  [Image]         │                        │ │
│  │                  │  │                  │                        │ │
│  └──────────────────┘  └──────────────────┘                        │ │
│                                                                     │ │
│  [Slider: ←───────────●──────────→]                                │ │
│                                                                     │ │
│  Status: Completed • 2 hours ago                                    │ │
│                                                                     │ │
│  [Download] [Regenerate]                                           │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Card Dimensions:**
- Width: 100% (responsive grid)
- Min-height: 400px
- Padding: 24px
- Border radius: 12px (rounded-xl)
- Background: White (#FFFFFF)
- Border: 1px solid gray-200
- Shadow: shadow-sm
- Hover: shadow-md, scale 1.01

**Image Comparison:**
- Layout: Side-by-side (desktop), stacked (mobile)
- Aspect ratio: 4:5 (portrait)
- Border radius: 8px
- Overflow: hidden
- Labels: "Before" and "After" (12px, text-muted)

**Slider:**
- Position: Between images (desktop), below images (mobile)
- Width: 100%
- Height: 4px
- Background: gray-200
- Thumb: brand-primary, 16px × 16px
- Function: Drag to reveal before/after

**Status Bar:**
- Typography: 12px, text-muted
- Icons: Status icon (checkmark, clock, etc.)
- Timestamp: Relative time ("2 hours ago")

**Action Buttons:**
- Layout: Horizontal row
- Spacing: 12px gap
- Download: brand-primary background, white text
- Regenerate: Gray border, text-gray-700
- Disabled: Gray background, muted text

**Empty State:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    [📷 Photo Icon - 64px]                          │
│                                                                     │
│                    No generations yet                                │
│                                                                     │
│         Upload a selfie and generate your first team photos        │
│                                                                     │
│                    [Upload Selfie →]                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Padding: 64px vertical, 32px horizontal
- Typography: Title (18px, semibold), description (14px, regular)
- Button: brand-primary background, white text

---

#### Generation Grid

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [Card] [Card] [Card]                                               │
│                                                                     │
│  [Card] [Card]                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Grid Specifications:**
- Columns: 3 (desktop), 2 (tablet), 1 (mobile)
- Gap: 24px (desktop), 16px (mobile)
- Responsive: Auto-fit with min-width 300px

**Loading State:**
- Skeleton cards with shimmer animation
- Same dimensions as generation cards
- Gray-200 background, animated gradient

---

### Responsive Design

**Mobile (< 768px):**
- Single column layout
- Stacked before/after images
- Full-width cards
- Larger touch targets
- Simplified actions

**Tablet (768px - 1024px):**
- 2-column grid
- Side-by-side images
- Standard card layout

**Desktop (> 1024px):**
- 3-column grid
- Enhanced hover states
- Larger images
- Smooth slider interaction

---

## 3. Generate Flow Redesign (PRIMARY FOCUS)

### Purpose

**THE PRIMARY GOAL:** Get users to generate photos as quickly as possible.

The generate flow is the main experience - everything else supports this. Selfie upload is integrated directly into this flow, not a separate step.

### User Flow (Speed-Optimized)

1. **Click "Generate Photos"** → Opens inline flow (prominent button on dashboard)
2. **Upload Selfies** → Drag-drop or camera (2+ required) - INLINE, part of flow
3. **Select Selfies** → Quick selection if multiple uploaded - INLINE
4. **Style** → Quick customization (if allowed) or skip - INLINE, minimal
5. **Generate** → Large, prominent button - ALWAYS VISIBLE
6. **View Results** → Redirect to generations page

**Key Principle:** Selfies are part of generation, not a separate concern. The flow should be fast, inline, and focused on getting to generation quickly.

### Flow Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Header (Sticky)                                                    │
│  [Team Name]                    Credits: 20 (5 photos)             │
│  ← Back to Dashboard                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Progress Indicator                                                  │
│  [●─────○─────○─────○] Step 1 of 4: Select Selfies                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Step Content                                                        │
│  (Changes based on current step)                                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Navigation                                                          │
│  [← Back]                                    [Continue →]           │
└─────────────────────────────────────────────────────────────────────┘
```

### Step 1: Upload & Select Selfies (Combined)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 1 of 4: Upload Your Selfies                                  │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Upload 2 or more selfies to generate your team photos             │ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │                                                               │ │ │
│  │              [📷 Camera Icon - 64px]                          │ │ │
│  │                                                               │ │ │
│  │         Drag and drop your selfies here                       │ │ │
│  │              or click to browse                                │ │ │
│  │                                                               │ │ │
│  │                    [Choose Files]                              │ │ │
│  │                                                               │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
│  ✓ Uploaded: 2 selfies                                             │ │
│                                                                     │ │
│  [Selfie] [Selfie]                                                 │ │
│   ✓        ✓                                                        │ │
│                                                                     │ │
│                    [Generate Photos →]                              │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Title: 24px, font-weight: 600
- Description: 16px, text-muted
- Upload zone: Large, prominent (min-height: 300px)
- Selection indicator: brand-primary-light background (when 2+ uploaded)
- Generate button: ALWAYS VISIBLE, prominent (brand-cta color)
- Auto-advance: When 2+ selfies uploaded and selected

---

### Step 2: Customize Style

**Layout:**
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

**Visual Specs:**
- Accordion sections for each category
- Preview thumbnails (80px × 80px)
- Selected summary at bottom
- Navigation buttons

**Categories:**
1. Background (Office, Neutral, Gradient, Custom)
2. Branding (Logo placement options)
3. Style Preset (Corporate, Casual, Creative, etc.)
4. Clothing (Style, accessories)
5. Expression (Professional, Friendly, Confident)
6. Lighting (Natural, Studio, Dramatic)

**Accordion:**
- Header: 48px height, brand-primary-light background
- Content: 24px padding
- Border radius: 8px
- Hover: Slight elevation

---

### Step 3: Review & Confirm

**Layout:**
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

**Visual Specs:**
- Two-column layout (desktop), stacked (mobile)
- Summary card: brand-primary-light background
- Cost display: Large, prominent (24px, bold)
- Generate button: brand-cta color, large size

---

### Step 4: Generate

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Step 4 of 4: Generating Photos                                    │
├─────────────────────────────────────────────────────────────────────┤ │
│                                                                     │ │
│  Your photos are being generated...                                 │ │
│                                                                     │ │
│  ┌───────────────────────────────────────────────────────────────┐ │ │
│  │  [Progress Bar: 45%]                                          │ │ │
│  │  Generating your photos... (45%)                            │ │ │
│  │  Estimated time: 30 seconds                                    │ │ │
│  └───────────────────────────────────────────────────────────────┘ │ │
│                                                                     │ │
│  This usually takes 30-60 seconds. Please don't close this page.   │ │
│                                                                     │ │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Progress bar: brand-primary color, animated
- Status text: 16px, text-body
- Estimated time: 14px, text-muted
- Warning: Orange background, subtle

**States:**
- **Queued**: "Your photos are queued..."
- **Processing**: "Generating your photos... (X%)"
- **Completed**: "Your photos are ready!" → Redirect
- **Failed**: Error message, retry button

---

### Progress Indicator

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [●─────○─────○─────○] Step 1 of 4: Select Selfies                │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Height: 48px
- Background: gray-50
- Padding: 16px horizontal
- Border-bottom: 1px solid gray-200

**Steps:**
- Completed: brand-secondary color, filled circle
- Active: brand-primary color, filled circle
- Pending: gray-300 color, empty circle
- Connector: Gray line between steps

**Mobile:**
- Compact version: Just step number and title
- "Step 1 of 4" text only

---

### Navigation Buttons

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back]                                    [Continue →]           │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Position: Bottom of step content, sticky (mobile)
- Back: Gray border, text-gray-700
- Continue: brand-primary background, white text
- Disabled: Gray background, muted text
- Padding: 12px 24px
- Border radius: 8px

**States:**
- **Enabled**: Full opacity, hover effects
- **Disabled**: 50% opacity, no hover
- **Loading**: Spinner, disabled state

---

### Responsive Design

**Mobile (< 768px):**
- Full-width steps
- Stacked layouts
- Compact progress indicator
- Sticky navigation buttons
- Larger touch targets

**Tablet (768px - 1024px):**
- Side-by-side layouts where appropriate
- Standard progress indicator
- Standard navigation

**Desktop (> 1024px):**
- Side-by-side content sections
- Full progress indicator
- Enhanced hover states
- Larger previews

---

## Brand Color Usage

### Critical Requirement

**No hardcoded brand colors in components.**

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

### Color Reference

**Primary:**
- `bg-brand-primary`: #6366F1 (Indigo-500)
- `bg-brand-primary-hover`: #4F46E5 (Indigo-600)
- `bg-brand-primary-light`: #EEF2FF (Indigo-50)

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

## Implementation Plan

### Phase 1: Integrated Generation Flow (Week 1) - PRIORITY

**Tasks:**
1. **Priority:** Create inline generation flow component
2. Integrate selfie upload directly into flow (not separate page)
3. Create prominent generate button (always visible)
4. Build inline selfie selection (part of flow)
5. Add auto-advance logic (when 2+ selfies uploaded)

**Deliverables:**
- **Inline generation flow (selfie upload integrated)**
- Prominent generate button component
- Inline selfie selection
- Auto-advance logic

**Note:** Selfies page redesign is LOW PRIORITY - focus on integrated flow first

---

### Phase 2: Generations Page (Week 2)

**Tasks:**
1. Redesign generation card component
2. Create before/after comparison slider
3. Implement action buttons
4. Add empty states
5. Create loading skeletons

**Deliverables:**
- Redesigned generations page
- Enhanced generation card
- Slider component

---

### Phase 3: Generate Flow (Week 3)

**Tasks:**
1. Create step-based flow component
2. Implement progress indicator
3. Build style selection interface
4. Create review & confirm step
5. Add generation progress component

**Deliverables:**
- Complete generate flow
- Step navigation system
- Progress tracking

---

### Phase 4: Integration & Polish (Week 4)

**Tasks:**
1. Integrate all pages with main dashboard
2. Add animations and transitions
3. Implement responsive breakpoints
4. Accessibility audit and fixes
5. Cross-browser testing
6. Performance optimization

**Deliverables:**
- Complete invite dashboard experience
- Animation system
- Accessibility report
- Performance metrics

---

## Content & Copy Guidelines

### Tone

- **Professional with warmth**: "Your selfies" not "Selfie management"
- **Action-focused**: "Select 2 selfies" not "Please select at least 2 selfies"
- **Clear outcomes**: "Good for 5 photos" not "Credits: 20"
- **Concise**: One idea per sentence, short paragraphs

### Voice

- **User perspective**: "You" and "your" (not "we" or "the user")
- **Exception**: When representing TeamShotsPro

### Examples

**Selfies Page:**
- ✅ "Select 2 or more selfies to generate your team photos"
- ❌ "Please select a minimum of 2 selfies in order to proceed with photo generation"

**Generations Page:**
- ✅ "Your generated photos"
- ❌ "Photo generation history"

**Generate Flow:**
- ✅ "Review your selections before generating"
- ❌ "Please review the following information before proceeding with the generation process"

**Error Messages:**
- ✅ "You need at least 2 selfies to generate photos. Upload another selfie to continue."
- ❌ "Error: Insufficient selfies selected. Minimum 2 required."

---

## Success Metrics

### User Experience

- **Time to first generation**: < 3 minutes from landing
- **Upload success rate**: > 95%
- **Generation completion rate**: > 90%
- **Mobile usage**: Optimized for mobile-first experience

### Technical

- **Page load time**: < 2 seconds (first contentful paint)
- **Time to interactive**: < 3 seconds
- **Accessibility score**: WCAG 2.1 AA compliant
- **Mobile performance**: Lighthouse score > 90

### Business

- **Generation rate**: Monitor photos generated per invite
- **User satisfaction**: Collect feedback post-redesign
- **Conversion**: Track signup CTA clicks

---

## References

- [Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md)
- [Invite Dashboard Visual Spec](./INVITE_DASHBOARD_VISUAL_SPEC.md)
- [Dashboard Visual Spec](./DASHBOARD_VISUAL_SPEC.md)
- [Brand Config](../src/config/brand.ts)
- [Text Guidelines](../.cursor/rules/text_guidelines.mdc)
- [Frontend Design Principles](../.cursor/rules/frontend-design.mdc)

---

**Next Steps:**
1. Review and approve design specifications
2. Prioritize components for implementation
3. Begin Phase 1: Selfies Page
4. Set up development environment
5. Create component library structure

