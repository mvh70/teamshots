# Invite Dashboard Redesign: Design & Implementation Plan

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase  
**Scope:** Complete reimagining of the team member invite dashboard experience

---

## Executive Summary

This document outlines a complete reimagining of the TeamShotsPro invite dashboard—the first experience team members have when accepting an invitation. The redesign transforms a functional but generic interface into a distinctive, welcoming experience that guides invited team members through photo generation with clarity, confidence, and delight.

**Key Goals:**
- Create a memorable first impression that reflects TeamShotsPro's professional yet approachable brand
- Guide users through the photo generation flow with clear visual hierarchy
- Maintain all existing functionality while elevating the aesthetic
- Ensure mobile-first responsive design
- Follow brand guidelines strictly (no hardcoded colors)

---

## Design Philosophy

### Aesthetic Direction: **Welcoming Professionalism**

**Core Concept:** The invite dashboard should feel like being welcomed into a professional team. It's polished enough for corporate environments, but warm enough to feel approachable and human. This is often the first touchpoint team members have with TeamShotsPro—it must make an excellent impression.

**Key Principles:**
- **Mobile-First**: Designed for mobile as the primary experience, then enhanced for desktop
- **Clarity First**: Every element guides users toward their goal (generate team photos)
- **Visual Breathing Room**: Generous whitespace prevents cognitive overload (especially on small screens)
- **Purposeful Motion**: Subtle animations that guide attention, not distract
- **Brand Consistency**: Every element reinforces TeamShotsPro's identity
- **Touch-Optimized**: Large touch targets, thumb-friendly interactions
- **Accessibility**: WCAG 2.1 AA compliance throughout

**Avoid:**
- Generic dashboard aesthetics (Inter font everywhere, purple gradients, cookie-cutter layouts)
- Overwhelming information density
- Cluttered interfaces
- Hardcoded brand colors (must use brand config)

---

## User Journey & Information Architecture

### Primary User Flow (Speed-Optimized)

**Goal:** Get users to generate photos as quickly as possible.

1. **Landing** → User clicks invite link, validates token
2. **Welcome** → Personalized greeting with team context
3. **Generate Flow** → Direct path to generation (selfie upload integrated)
   - Upload selfies (2+ required) - inline, part of flow
   - Select selfies (if multiple uploaded)
   - Style selection (if allowed) - quick, minimal
   - Generate → Prominent button, clear CTA
4. **Review** → Generated photos gallery
5. **Signup CTA** → Optional account creation

**Key Principle:** Selfies are part of the generation process, not a separate concern. Users shouldn't need to manage selfies separately - they upload and generate in one flow.

### Dashboard States

#### State 1: First-Time Visitor (No Generations)
**Goal:** Get user to generate photos immediately
- Prominent "Generate Photos" button (primary CTA)
- Credit status visible but minimal
- Direct generation flow (selfie upload integrated)
- No separate selfie management - it's part of the flow

#### State 2: Has Generations
**Goal:** Show success, enable more generations quickly
- Recent photos gallery (small, not dominant)
- Large "Generate More Photos" button (primary CTA)
- Credit balance with "good for X photos" indicator
- Quick access to view all generations

#### State 3: Low Credits
**Goal:** Inform user, guide to admin contact
- Warning banner (not alarming)
- Clear messaging about contacting admin
- Disabled generate button with explanation
- Still show recent photos if available

---

## Visual Design System

### Typography

**Font Stack:**
```css
/* Headings - Display font */
font-family: var(--font-display), 'Georgia', 'Times New Roman', serif;

/* Body - System font */
font-family: var(--font-body), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Type Scale:**
- **H1 (Page Title)**: 32px (mobile: 28px), weight 700, line-height 1.2
- **H2 (Section Headers)**: 24px (mobile: 20px), weight 600, line-height 1.3
- **H3 (Card Titles)**: 18px, weight 600, line-height 1.4
- **Body Large**: 16px, weight 400, line-height 1.6
- **Body**: 14px, weight 400, line-height 1.5
- **Small/Caption**: 12px, weight 400, line-height 1.4

**Rationale:** Display font for headings adds character and memorability. System font for body ensures excellent readability and performance.

### Color Palette

**From Brand Config (`src/config/brand.ts`):**

**Primary Colors:**
- `brand-primary`: #6366F1 (Indigo-500) - Main actions, links, emphasis
- `brand-primary-hover`: #4F46E5 (Indigo-600) - Hover states
- `brand-primary-light`: #EEF2FF (Indigo-50) - Subtle backgrounds, badges

**Secondary Colors:**
- `brand-secondary`: #10B981 (Green-500) - Success states, positive metrics
- `brand-secondary-hover`: #059669 (Green-600) - Hover states

**Accent/CTA:**
- `brand-cta`: #EA580C (Orange-600) - Primary CTAs, urgent actions
- `brand-cta-hover`: #C2410C (Orange-700) - Hover states
- `brand-cta-light`: #FFF7ED (Orange-50) - Subtle backgrounds

**Neutrals:**
- `text-dark`: #111827 - Primary text
- `text-body`: #374151 - Body text
- `text-muted`: #6B7280 - Secondary text, labels
- `bg-white`: #FFFFFF - Card backgrounds
- `bg-gray-50`: #F9FAFB - Page background

**Usage Guidelines:**
- ✅ Use brand colors via Tailwind classes (`bg-brand-primary`, `text-brand-cta`)
- ✅ Never hardcode color values in components
- ✅ Maintain sufficient contrast ratios (4.5:1 minimum)
- ✅ Reserve CTA orange for primary actions only (max 2-3 per viewport)
- ✅ Use green sparingly for success states

### Spacing System

**Base Unit:** 4px

**Scale:**
- `xs`: 4px (0.25rem)
- `sm`: 8px (0.5rem)
- `md`: 16px (1rem)
- `lg`: 24px (1.5rem)
- `xl`: 32px (2rem)
- `2xl`: 48px (3rem)
- `3xl`: 64px (4rem)

**Component Spacing:**
- Card padding: 24px (lg)
- Section spacing: 32px (xl)
- Grid gaps: 24px (lg)
- Element spacing: 16px (md)

### Layout Principles (Mobile-First)

**Grid System:**
- Mobile-first: Start with single column, add columns at larger breakpoints
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Max content width: 1280px (xl) - but mobile is primary
- Touch-optimized spacing (minimum 16px between interactive elements)

**Content Hierarchy (Mobile-Optimized):**
1. **Header** (compact, sticky) - Team name, credits only
2. **Welcome Section** (full width, compact) - Personalized greeting
3. **Hero Generate Button** (full width, massive) - PRIMARY CTA
4. **Credit Status** (minimal, single line) - Secondary info
5. **Recent Photos** (compact grid, 2 columns) - Only if photos exist
6. **Signup CTA** (full width, bottom) - Account creation prompt

**Mobile-Specific Considerations:**
- Single column layout (no side-by-side content)
- Full-width buttons (easier to tap)
- Larger touch targets (minimum 44px × 44px)
- Thumb-friendly zones (primary actions in bottom half of screen)
- Sticky navigation/actions (generate button always accessible)
- Minimal scrolling required (key actions visible above fold)

**Whitespace Strategy (Mobile):**
- Reduced padding (16px instead of 24px) to maximize screen space
- Clear visual separation between sections
- Breathing room around interactive elements (16px minimum)
- Consistent vertical rhythm (8px base unit)

---

## Component Design Specifications

### 1. Header Component (Mobile-Optimized)

**Purpose:** Minimal, compact header that doesn't compete with primary CTA

**Design:**
- Compact mobile header (single line, minimal)
- Team name and credits only (no subtitle on mobile)
- Sticky position (always accessible)
- Back button when in flows (left side, large touch target)

**Layout:**
```
Mobile (Primary):
┌─────────────────────────────────────┐
│  ←  Acme Corp        20 (5 photos)  │
└─────────────────────────────────────┘

Desktop:
┌─────────────────────────────────────────────────────────────┐
│  [Team Name]                    Credits: 20 (5 photos)     │
│  Welcome back, Sarah                                        │
└─────────────────────────────────────────────────────────────┘
```

**Visual Specs (Mobile):**
- Height: 56px (compact)
- Padding: 12px vertical, 16px horizontal
- Background: white with subtle border-bottom
- Typography: Team name (16px, semibold), credits (14px, bold, brand-primary)
- Back button: 44px × 44px touch target, left-aligned
- Single line layout (no wrapping)

**Visual Specs (Desktop):**
- Height: 80px
- Padding: 16px vertical, 24px horizontal
- Typography: Team name (18px), credits (16px), subtitle (14px)

**Implementation Notes:**
- Mobile-first: Design for mobile, enhance for desktop
- Ensure back button is large enough for thumb (44px minimum)
- Credits should be right-aligned for easy scanning
- Use brand colors from config
- Sticky on scroll (mobile and desktop)

---

### 2. Welcome Section (Mobile-Optimized)

**Purpose:** Quick, compact greeting that doesn't take up too much screen space

**Design:**
- Compact on mobile (minimal vertical space)
- Full-width gradient background
- White text overlay
- Short, punchy copy (mobile-friendly)
- Subtle animation on load

**Content Variations (Mobile-Optimized):**

**First-Time User:**
```
"Welcome, [Name]! 🎉"
"Generate your team photos in 60 seconds."
```

**Returning User (Has Generations):**
```
"Welcome back, [Name]! 👋"
"Generate more photos?"
```

**Visual Specs (Mobile):**
- Padding: 24px vertical, 16px horizontal (reduced for mobile)
- Typography: Title (24px, bold), subtitle (14px, regular)
- Border radius: 12px
- Background: Gradient from brand-primary to brand-primary-hover
- Text color: White
- Height: Auto, but compact (don't dominate screen)

**Visual Specs (Desktop):**
- Padding: 32px vertical, 24px horizontal
- Typography: Title (32px), subtitle (18px)
- More generous spacing

**Implementation Notes:**
- Mobile-first: Compact copy, reduced padding
- Use brand colors from config
- Keep it short - don't compete with generate button
- Responsive text sizing (smaller on mobile)
- Animation: Subtle fade-in (fast, 300ms)

---

### 3. Credit Status Card

**Purpose:** Always-visible credit balance with clear action path

**Design:**
- Prominent card at top of stats grid
- Large credit number (primary focus)
- Secondary info: "X generations available"
- Visual progress indicator (if applicable)
- Quick action: "Contact admin" link (if low credits)

**Layout:**
```
┌─────────────────────────────┐
│  💎 Credits                 │
│                             │
│  20                        │
│  credits                   │
│                             │
│  Good for 5 photos         │
│                             │
│  [Contact admin →]         │  (if low credits)
└─────────────────────────────┘
```

**Visual Treatment:**
- Icon: Diamond/sparkle icon (brand-primary color)
- Large number: 32px, font-weight: 700, brand-primary color
- Secondary text: 14px, text-muted
- CTA link: brand-cta color, hover underline
- Background: white with subtle border

**States:**
- **Sufficient Credits**: Green accent, positive messaging
- **Low Credits**: Orange accent, warning messaging, admin contact CTA
- **No Credits**: Red accent, disabled state, clear admin contact

**Implementation Notes:**
- Calculate "photos affordable" dynamically
- Use brand colors from Tailwind config
- Add subtle hover elevation
- Mobile: Stack vertically, maintain readability

---

### 4. Stats Cards Grid

**Purpose:** Quick overview of key metrics

**Design Principles:**
- Consistent card structure
- Icon + number + label pattern
- Subtle hover elevation
- Clear visual hierarchy

**Card Structure:**
```
┌─────────────────────┐
│  [Icon]  Label      │
│          Value      │
│          Change     │
└─────────────────────┘
```

**Visual Specs:**
- Background: white
- Border: 1px solid gray-200
- Border radius: 12px (rounded-xl)
- Padding: 24px (lg)
- Shadow: subtle (shadow-sm)
- Hover: shadow-md, slight scale (1.02)

**Icon Treatment:**
- 40px × 40px container
- Background: brand-primary-light
- Icon: brand-primary color, 24px
- Border radius: 10px

**Stats Displayed:**
1. Credits (always first, most prominent)
2. Photos Generated
3. Selfies Uploaded

**Change Indicators:**
- Green (brand-secondary) for increases
- Format: "+X" or "X total"
- Small text, subtle

**Implementation Notes:**
- Use Grid component for responsive layout
- Ensure icons use brand colors
- Add loading skeleton states
- Mobile: Single column, full width

---

### 5. Hero Generate Button (Mobile-Optimized, Primary CTA)

**Purpose:** THE single most important action - generate photos immediately

**Design:**
- Massive, impossible-to-miss button
- Mobile-optimized: Full width, thumb-friendly
- Takes center stage on the page
- Clear, action-oriented copy (mobile-friendly length)
- Selfie upload integrated into the flow (not a separate step)

**Layout (Mobile - Primary):**
```
┌─────────────────────────────────────┐
│                                     │
│         [📸 Icon - 64px]            │
│                                     │
│    Generate Your Team Photos        │
│                                     │
│    Upload selfies and create        │
│    professional headshots           │
│                                     │
│    [Generate Photos →]              │
│                                     │
└─────────────────────────────────────┘
```

**Layout (Desktop):**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                    [📸 Large Icon - 80px]                          │
│                                                                     │
│              Generate Your Team Photos                              │
│                                                                     │
│         Upload your selfies and create professional headshots       │
│         in under 60 seconds                                         │
│                                                                     │
│                    [Generate Photos →]                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Treatment (Mobile):**
- Background: brand-cta (orange) - maximum visibility
- Text: White, large (18px button text)
- Icon: 64px, white (smaller for mobile)
- Padding: 48px vertical, 24px horizontal (generous but mobile-optimized)
- Border radius: 16px (more rounded, friendly)
- Shadow: Large, prominent shadow-lg
- Size: Full width (100% - no margins)
- Touch target: Minimum 88px height (easy thumb tap)
- Position: Sticky at bottom when scrolling (always accessible)

**Visual Treatment (Desktop):**
- Padding: 64px vertical, 48px horizontal
- Icon: 80px
- Text: 20px
- Max-width: 600px centered
- Hover: Scale 1.03, deeper shadow, brand-cta-hover

**States:**
- **Enabled**: Full brand-cta color, white text, prominent shadow
- **Disabled**: Gray background, muted text, explanation below button
- **Loading**: Spinner, disabled interaction, "Generating..." text

**Mobile-Specific Features:**
- Sticky positioning (stays at bottom when scrolling)
- Full-width (no side margins)
- Large touch target (minimum 88px height)
- Thumb-friendly (positioned in bottom half of screen)
- Haptic feedback on tap (if available)

**Implementation Notes:**
- Mobile-first: Design for mobile, enhance for desktop
- This is THE primary action - make it unmissable
- Use brand-cta color from config
- Ensure sufficient contrast (WCAG AA+)
- Add smooth transitions (no hover on mobile, active state instead)
- Sticky positioning on mobile (always accessible)
- When clicked, opens inline generation flow (selfie upload integrated)

---

### 6. Recent Photos Gallery (Secondary, Compact)

**Purpose:** Show success, but don't distract from primary CTA

**Design:**
- Small, compact gallery (not dominant)
- Shows recent photos if available
- "View all" link to generations page
- Only shown if user has generated photos
- Positioned below primary CTA (not competing for attention)

**Layout:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Your Photos              [View all →]                             │
│                                                                     │
│  [Photo] [Photo] [Photo] [Photo]                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Visual Specs:**
- Thumbnail size: 100px × 100px (desktop), 80px × 80px (mobile)
- Border radius: 8px
- Aspect ratio: 1:1 (square)
- Hover: Scale 1.05, subtle shadow
- Grid gap: 12px (sm)
- Max 4 thumbnails shown (then "View all" link)

**Empty State:**
- Hidden if no photos (don't show empty state - just show generate button)

**Implementation Notes:**
- Use Next.js Image component for optimization
- Lazy load images
- Keep it compact - don't compete with primary CTA
- Only render if user has generated photos

---

### 7. Integrated Generation Flow (Selfie Upload Included)

**Purpose:** Streamlined flow that gets users to generation quickly

**Design:**
- Single, integrated flow (not separate pages)
- Selfie upload is part of generation, not separate
- Minimal steps, maximum speed
- Prominent generate button throughout

**Flow Steps (All Inline):**
1. **Upload Selfies** → Drag-drop or camera (2+ required)
2. **Select Selfies** → Quick selection if multiple uploaded
3. **Style** → Quick customization (if allowed) or skip
4. **Generate** → Large, prominent button

**Visual Specs:**
- Inline modal/panel (not full page navigation)
- Progress indicator: Simple dots (4 steps)
- Each step: Card-based, clear actions
- Generate button: Always visible, always prominent

**Upload Interface:**
- Large drop zone (min-height: 300px)
- Drag-drop visual feedback
- Camera icon for mobile capture
- "Upload 2+ selfies" helper text
- Auto-advance when 2+ uploaded

**Selection Interface:**
- Grid of uploaded selfies
- Checkbox overlay on selection
- "Selected: X selfies" indicator
- Auto-advance when 2+ selected

**Style Selection:**
- Quick accordion (if admin-enabled)
- Or skip if admin-controlled
- Minimal time spent here

**Generate Button:**
- Large, prominent (brand-cta color)
- Always visible at bottom
- Shows cost and remaining credits
- Disabled until 2+ selfies selected

**Implementation Notes:**
- This is an inline flow, not separate pages
- Selfie management is NOT a separate concern
- Focus on speed - minimize clicks
- Generate button should be prominent throughout
- Use existing components but integrate them inline

---

### 8. Style Selection Interface

**Purpose:** Allow customization (if admin-enabled) or preview settings

**Design:**
- Accordion-style sections for each category
- Visual previews where applicable
- Clear labels and descriptions
- Disabled state if admin-controlled

**Categories:**
1. Background
2. Branding (logo placement)
3. Style preset
4. Clothing
5. Expression
6. Lighting

**Visual Specs:**
- Accordion header: 48px height, brand-primary-light background
- Content padding: 24px
- Preview thumbnails: 80px × 80px
- Selected state: brand-primary border

**Implementation Notes:**
- Use existing `StyleSettingsSection` component
- Enhance with better visual hierarchy
- Add preview thumbnails where applicable
- Ensure readonly state is clear

---

### 9. Generation Progress

**Purpose:** Show real-time generation progress

**Design:**
- Full-screen overlay or modal
- Progress bar with percentage
- Status messages
- Estimated time remaining
- Cancel option (if applicable)

**Visual Specs:**
- Background: White with subtle backdrop blur
- Progress bar: brand-primary color
- Status text: text-body
- Animation: Smooth progress updates

**States:**
- **Queued**: "Your photos are queued..."
- **Processing**: "Generating your photos... (45%)"
- **Completed**: "Your photos are ready!" → Redirect to gallery

**Implementation Notes:**
- Use WebSocket or polling for updates
- Show realistic progress (not fake)
- Add smooth animations
- Handle errors gracefully

---

### 10. Signup CTA Card

**Purpose:** Encourage account creation for better experience

**Design:**
- Subtle, non-intrusive card at bottom
- Clear benefits of signing up
- Single CTA button
- Dismissible (optional)

**Layout:**
```
┌─────────────────────────────────────┐
│  Create an account                  │
│                                     │
│  Save your photos, track your       │
│  history, and manage your profile   │
│                                     │
│  [Sign up →]                        │
│                                     │
└─────────────────────────────────────┘
```

**Visual Specs:**
- Background: brand-primary-light (subtle)
- Border: 1px solid brand-primary-light
- Padding: 24px
- CTA button: brand-cta color

**Implementation Notes:**
- Use brand colors from config
- Keep copy concise (per text guidelines)
- Mobile: Full width, maintain padding
- Optional: Add dismiss functionality

---

## Responsive Design (Mobile-First)

### Mobile (< 768px) - PRIMARY EXPERIENCE

**Design Philosophy:**
- Mobile is the primary experience, not an afterthought
- Every component designed for mobile first
- Desktop is an enhancement, not the base

**Key Adaptations:**
- **Single column layout** (no side-by-side content)
- **Reduced padding** (16px instead of 24px) to maximize screen space
- **Full-width components** (buttons, cards, inputs)
- **Compact header** (56px height, single line)
- **Large touch targets** (minimum 44px × 44px, preferably 48px+)
- **Thumb-friendly zones** (primary actions in bottom 2/3 of screen)
- **Sticky actions** (generate button always accessible)
- **Minimal scrolling** (key actions visible above fold)
- **Stacked content** (no horizontal grids)

**Typography (Mobile):**
- Reduced font sizes (H1: 28px instead of 32px)
- Tighter line heights (1.2-1.3 for headings)
- Shorter copy (mobile-optimized text)

**Spacing (Mobile):**
- Base unit: 8px (instead of 16px for some elements)
- Card padding: 16px (instead of 24px)
- Section spacing: 24px (instead of 32px)
- Element gaps: 12px (instead of 16px)

**Navigation:**
- Back button (large, left-aligned, 44px touch target)
- Sticky generate button (bottom, always accessible)
- No hamburger menu (minimal navigation needed)
- Swipe gestures for galleries (optional enhancement)

**Touch Optimization:**
- All interactive elements: Minimum 44px × 44px
- Button padding: 16px vertical, 24px horizontal
- Gap between buttons: 12px minimum
- No hover states (use active/tap states instead)

### Tablet (768px - 1024px)

**Key Adaptations:**
- 2-column grid for stats (if needed)
- Side-by-side layouts where appropriate
- Maintain mobile spacing (don't jump to desktop)
- Touch targets still large (44px minimum)

### Desktop (> 1024px) - ENHANCEMENT

**Key Adaptations:**
- 3-column grid for stats (enhancement)
- Side-by-side content sections (enhancement)
- Hover states and interactions (enhancement)
- Sticky header (enhancement)
- Generous whitespace (enhancement)
- Larger typography (enhancement)

**Desktop Enhancements:**
- Hover effects (not available on mobile)
- Larger images/previews
- More generous spacing
- Side-by-side layouts
- Enhanced animations

---

## Animation & Motion

### Principles

- **Purposeful**: Every animation guides attention or provides feedback
- **Subtle**: Animations enhance, don't distract
- **Fast**: Most animations complete in 200-400ms
- **Easing**: Use ease-out for natural feel

### Key Animations

1. **Page Load**: Fade-in + slide-up (600ms)
2. **Card Hover**: Scale 1.02 + shadow increase (200ms)
3. **Button Click**: Scale 0.98 (100ms)
4. **Modal Open**: Fade-in + scale (300ms)
5. **Progress Bar**: Smooth width transition (per update)

### Implementation

- Use CSS transitions for simple animations
- Use Framer Motion for complex sequences
- Respect `prefers-reduced-motion` media query
- Test on lower-end devices

---

## Accessibility

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Text on white: Minimum 4.5:1
- Text on brand colors: Verify contrast ratios
- Interactive elements: Clear focus states

**Keyboard Navigation:**
- All interactive elements keyboard accessible
- Logical tab order
- Skip links for main content
- Focus indicators visible

**Screen Readers:**
- Semantic HTML elements
- ARIA labels where needed
- Alt text for images
- Status announcements for dynamic content

**Touch Targets (Mobile-Critical):**
- **Minimum 44px × 44px** (Apple HIG standard)
- **Preferred 48px × 48px** (Android Material Design)
- **Primary actions: 56px+** (generate button, main CTAs)
- **Adequate spacing**: 12px minimum between targets (prevents mis-taps)
- **No overlapping**: Clear separation between interactive elements
- **Thumb zones**: Primary actions in bottom 2/3 of screen (natural thumb reach)
- **Edge padding**: 16px minimum from screen edges (prevents accidental taps)

---

## Implementation Plan

### Phase 1: Foundation (Week 1)

**Tasks:**
1. Audit current invite dashboard code
2. Create component library structure
3. Set up brand color system (ensure no hardcoded values)
4. Create base layout components
5. Implement responsive grid system
6. **Priority:** Create prominent generate button component

**Deliverables:**
- Component structure documented
- Brand color audit complete
- Base layout components
- Hero generate button component

---

### Phase 2: Core Components (Week 2) - Mobile-First

**Tasks:**
1. **Priority:** Create mobile-optimized hero generate button (full width, sticky, thumb-friendly)
2. Redesign header component (compact mobile, minimal, credits only)
3. Create welcome section component (mobile-optimized, compact copy)
4. Build stats cards grid (compact, not dominant, mobile-first)
5. Implement credit status card (minimal, mobile-optimized)
6. Create inline generation flow component (mobile-optimized)

**Deliverables:**
- **Mobile-optimized hero generate button (primary focus)**
- Compact mobile header
- Mobile-optimized welcome section
- Stats cards (compact, mobile-first)
- Credit card (minimal, mobile-optimized)
- Inline generation flow component (mobile-first)

**Mobile-Specific Requirements:**
- All components designed mobile-first
- Touch targets minimum 44px × 44px
- Full-width buttons on mobile
- Sticky generate button
- Thumb-friendly positioning

---

### Phase 3: Integrated Flow (Week 3) - Mobile-Optimized

**Tasks:**
1. **Priority:** Integrate selfie upload into generation flow (mobile-optimized, not separate)
2. Create inline selfie selection (mobile-optimized, thumb-friendly)
3. Enhance style selection interface (quick, minimal, mobile-friendly)
4. Build generation progress component (mobile-optimized, clear on small screens)
5. Create compact recent photos gallery (mobile-optimized, 2-column grid)
6. Implement signup CTA card (mobile-optimized, full width)

**Deliverables:**
- **Mobile-optimized integrated generation flow (selfie upload included)**
- Mobile-optimized inline selfie selection
- Mobile-friendly style selection UI
- Mobile-optimized progress component
- Mobile-optimized compact gallery component
- Mobile-optimized signup CTA

**Mobile-Specific Requirements:**
- Full-screen or modal overlay on mobile (not inline on page)
- Large touch targets throughout flow
- Sticky generate button (always accessible)
- Thumb-friendly positioning
- Minimal scrolling required
- Clear progress indicators (dots or steps)
- Large, clear action buttons

**Key Principle:** Selfies are part of generation, not a separate page/concern. Mobile-first design throughout.

---

### Phase 4: Integration & Polish (Week 4)

**Tasks:**
1. Integrate all components into main dashboard
2. Add animations and transitions
3. Implement responsive breakpoints
4. Accessibility audit and fixes
5. Cross-browser testing
6. Performance optimization

**Deliverables:**
- Complete invite dashboard
- Animation system
- Accessibility report
- Performance metrics

---

### Phase 5: Testing & Refinement (Week 5)

**Tasks:**
1. User testing (internal)
2. Bug fixes and refinements
3. Mobile device testing
4. Final accessibility audit
5. Documentation updates

**Deliverables:**
- Test report
- Bug fixes
- Updated documentation
- Deployment ready

---

## Technical Considerations

### Brand Color System

**Critical Requirement:** No hardcoded brand colors in components.

**Implementation:**
- Use Tailwind classes: `bg-brand-primary`, `text-brand-cta`, etc.
- Reference `src/config/brand.ts` for any programmatic access
- Use CSS variables from `globals.css` if needed
- Audit all components for hardcoded hex values

**Example:**
```tsx
// ✅ Correct
<div className="bg-brand-primary text-white">

// ❌ Incorrect
<div style={{ backgroundColor: '#6366F1' }}>
```

### Component Structure

**Organization:**
```
src/components/invite-dashboard/
  ├── Header.tsx
  ├── WelcomeSection.tsx
  ├── CreditCard.tsx
  ├── StatsGrid.tsx
  ├── PrimaryActionCard.tsx
  ├── RecentPhotosGallery.tsx
  ├── SelfieUploadFlow.tsx
  ├── StyleSelection.tsx
  ├── GenerationProgress.tsx
  └── SignupCTA.tsx
```

### State Management

**Approach:**
- Use React hooks for local state
- Context API for shared state (credits, user info)
- Server state via SWR or React Query
- URL params for flow state (optional)

### Performance

**Optimizations:**
- Lazy load images below fold
- Code splitting for heavy components
- Memoization for expensive computations
- Optimistic UI updates where appropriate

---

## Content & Copy Guidelines

### Tone

- **Professional with warmth**: "Welcome back, Sarah!" not "User dashboard"
- **Action-focused**: "Generate photos" not "Photo generation"
- **Clear outcomes**: "Good for 5 photos" not "Credits: 20"
- **Concise**: One idea per sentence, short paragraphs

### Voice

- **User perspective**: "You" and "your" (not "we" or "the user")
- **Exception**: When representing TeamShotsPro (e.g., "We'll send you an email")

### Examples

**Welcome Messages:**
- ✅ "Welcome to Acme Corp, Sarah! Upload your selfie and generate your professional team photo in under 60 seconds."
- ❌ "Welcome to the team photo generation dashboard. Please upload a selfie to begin."

**Credit Display:**
- ✅ "20 credits (good for 5 photos)"
- ❌ "Credit balance: 20. Each generation costs 4 credits."

**CTAs:**
- ✅ "Generate your team photos"
- ❌ "Click here to start the photo generation process"

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

- **Signup conversion**: Track CTA clicks
- **Generation rate**: Monitor photos generated per invite
- **User satisfaction**: Collect feedback post-redesign

---

## Open Questions & Decisions Needed

1. **Animation Library**: Use Framer Motion or CSS-only animations?
2. **Image Optimization**: Current Next.js Image setup sufficient?
3. **State Management**: Need global state management (Zustand/Redux) or hooks sufficient?
4. **Testing**: Unit tests, integration tests, or E2E tests priority?
5. **Internationalization**: Full i18n support needed immediately or English-first?
6. **Analytics**: What events to track for invite dashboard?

---

## Related Pages

This document covers the main invite dashboard. For detailed specifications on individual pages, see:

- **[Invite Dashboard Pages Redesign](./INVITE_DASHBOARD_PAGES_REDESIGN.md)** - Selfies page, Generations page, and Generate flow
- **[Invite Dashboard Pages Visual Spec](./INVITE_DASHBOARD_PAGES_VISUAL_SPEC.md)** - Visual layouts for all pages

## References

- [Dashboard Visual Spec](./DASHBOARD_VISUAL_SPEC.md)
- [Dashboard Redesign](./DASHBOARD_REDESIGN.md)
- [Landing Page Visual Spec](./LANDING_PAGE_VISUAL_SPEC.md)
- [Brand Config](../src/config/brand.ts)
- [Text Guidelines](../.cursor/rules/text_guidelines.mdc)
- [Frontend Design Principles](../.cursor/rules/frontend-design.mdc)

---

## Appendix: Component Checklist

### Must-Have Components (Priority Order)
- [ ] **Hero Generate Button** (massive, prominent, primary CTA)
- [ ] **Inline Generation Flow** (selfie upload integrated, not separate)
- [ ] Header (minimal, credits only)
- [ ] Welcome Section (personalized greeting)
- [ ] Credit Status (minimal, not dominant)
- [ ] Recent Photos Gallery (compact, secondary, only if photos exist)
- [ ] Style Selection Interface (quick, minimal, if admin-enabled)
- [ ] Generation Progress (real-time updates)
- [ ] Signup CTA Card (account creation prompt)

### Removed/De-emphasized
- ❌ Separate selfies page (selfies are part of generation flow)
- ❌ Selfie management interface (not needed - part of flow)
- ❌ Dominant stats cards (minimal, don't distract from CTA)

### Nice-to-Have Components
- [ ] Empty States (friendly, actionable)
- [ ] Loading Skeletons (smooth loading experience)
- [ ] Error Boundaries (graceful error handling)
- [ ] Success Animations (celebration on completion)
- [ ] Help Tooltips (contextual guidance)

---

**Next Steps:**
1. Review and approve design direction
2. Prioritize components for implementation
3. Set up development environment
4. Begin Phase 1 implementation

