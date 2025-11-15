# Invite Dashboard Design Summary

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase Complete

---

## Overview

This document provides a high-level summary of the complete invite dashboard redesign, covering all pages and flows for team members accessing TeamShotsPro via invitation tokens.

---

## Design Documents

### 1. Main Dashboard
- **[Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md)** - Main dashboard design philosophy, components, and implementation plan
- **[Invite Dashboard Visual Spec](./INVITE_DASHBOARD_VISUAL_SPEC.md)** - Visual layouts and component specifications for the main dashboard

### 2. Individual Pages
- **[Invite Dashboard Pages Redesign](./INVITE_DASHBOARD_PAGES_REDESIGN.md)** - Selfies page, Generations page, and Generate flow design
- **[Invite Dashboard Pages Visual Spec](./INVITE_DASHBOARD_PAGES_VISUAL_SPEC.md)** - Visual layouts for all pages

---

## Design Philosophy

### Core Aesthetic: **Welcoming Professionalism**

The invite dashboard should feel like being welcomed into a professional team. It's polished enough for corporate environments, but warm enough to feel approachable and human.

**Key Principles:**
- **Clarity First**: Every element guides users toward their goal
- **Visual Breathing Room**: Generous whitespace prevents cognitive overload
- **Purposeful Motion**: Subtle animations that guide attention
- **Brand Consistency**: All colors from brand config, no hardcoded values
- **Mobile-First**: Optimized for the most common access point
- **Accessibility**: WCAG 2.1 AA compliance throughout

---

## Pages Designed

### 1. Main Dashboard (`/invite-dashboard/[token]`)

**Purpose:** Landing page for invited team members

**Key Components:**
- Header (team context, credits, navigation)
- Welcome section (personalized greeting)
- Credit status card (prominent balance)
- Stats grid (credits, photos, selfies)
- Primary action card (generate photos CTA)
- Recent photos gallery
- Signup CTA card

**User Goals:**
- See credit balance and status
- Quick access to generate photos
- View recent activity
- Navigate to selfies or generations

---

### 2. Selfies Page (`/invite-dashboard/[token]/selfies`)

**Purpose:** Upload and manage selfies

**Key Components:**
- Page header (title, description)
- Selection info banner (selected count, continue button)
- Selfie gallery grid (multi-select interface)
- Upload flow component (inline upload)
- Empty state (friendly CTA)

**User Goals:**
- Upload new selfies (camera or file)
- View all uploaded selfies
- Select 2+ selfies for generation
- Delete unused selfies
- Continue to generation flow

---

### 3. Generations Page (`/invite-dashboard/[token]/generations`)

**Purpose:** View and manage generated photos

**Key Components:**
- Page header (title, description)
- Generation grid (responsive card layout)
- Generation card (before/after comparison)
- Before/after slider (interactive comparison)
- Action buttons (download, regenerate)
- Empty state (friendly CTA)

**User Goals:**
- View all generated photos
- Compare before/after (selfie vs generated)
- Download photos
- Regenerate photos (if credits available)
- Navigate back to dashboard

---

### 4. Generate Flow (Inline in dashboard)

**Purpose:** Step-by-step photo generation process

**Key Components:**
- Progress indicator (4-step progress bar)
- Step 1: Select selfies (2+ required)
- Step 2: Customize style (if allowed)
- Step 3: Review & confirm (summary, cost)
- Step 4: Generate (real-time progress)
- Navigation buttons (back, continue)

**User Goals:**
- Select 2+ selfies
- Customize photo style (if admin-enabled)
- Review selections and cost
- Generate photos with real-time progress
- View results in generations page

---

## Design System

### Typography

**Display Font (Headings):**
- `var(--font-display)` - Characterful serif for headings
- Usage: H1, H2, H3, hero titles, section headers

**Body Font (Content):**
- `var(--font-body)` - System font for body text
- Usage: Body text, descriptions, captions

**Type Scale:**
- H1: 32px (desktop), 28px (mobile)
- H2: 24px (desktop), 20px (mobile)
- H3: 18px
- Body: 16px (desktop), 14px (mobile)
- Small: 12px

---

### Color Palette

**From Brand Config (`src/config/brand.ts`):**

**Primary:**
- `brand-primary`: #6366F1 (Indigo-500) - Main actions, links
- `brand-primary-hover`: #4F46E5 (Indigo-600)
- `brand-primary-light`: #EEF2FF (Indigo-50) - Subtle backgrounds

**Secondary:**
- `brand-secondary`: #10B981 (Green-500) - Success states
- `brand-secondary-hover`: #059669 (Green-600)

**CTA:**
- `brand-cta`: #EA580C (Orange-600) - Primary CTAs
- `brand-cta-hover`: #C2410C (Orange-700)
- `brand-cta-light`: #FFF7ED (Orange-50)

**Neutrals:**
- `text-dark`: #111827 - Primary text
- `text-body`: #374151 - Body text
- `text-muted`: #6B7280 - Secondary text
- `bg-white`: #FFFFFF - Card backgrounds
- `bg-gray-50`: #F9FAFB - Page background

**Critical Rule:** Never hardcode colors. Always use Tailwind classes or brand config.

---

### Spacing System

**Base Unit:** 4px

**Scale:**
- `xs`: 4px (0.25rem)
- `sm`: 8px (0.5rem)
- `md`: 16px (1rem)
- `lg`: 24px (1.5rem)
- `xl`: 32px (2rem)
- `2xl`: 48px (3rem)

**Component Spacing:**
- Card padding: 24px
- Section spacing: 32px
- Grid gaps: 24px
- Element spacing: 16px

---

### Layout Principles

**Grid System:**
- 12-column responsive grid
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Max content width: 1280px

**Content Hierarchy:**
1. Header (sticky)
2. Welcome section (full width)
3. Primary stats (grid)
4. Main content (flexible)
5. Quick actions (horizontal grid)
6. Signup CTA (full width, bottom)

---

## Responsive Design

### Mobile (< 768px)
- Single column layout
- Stacked cards
- Compact header
- Full-width buttons
- Larger touch targets (44px minimum)

### Tablet (768px - 1024px)
- 2-column grid for galleries
- Side-by-side where appropriate
- Standard spacing

### Desktop (> 1024px)
- 3-column grid for galleries
- Side-by-side content sections
- Sticky header
- Enhanced hover states

---

## Animation & Motion

### Principles
- **Purposeful**: Every animation guides attention
- **Subtle**: Animations enhance, don't distract
- **Fast**: Most animations complete in 200-400ms
- **Easing**: Use ease-out for natural feel

### Key Animations
1. Page load: Fade-in + slide-up (600ms)
2. Card hover: Scale 1.02 + shadow (200ms)
3. Button click: Scale 0.98 (100ms)
4. Step transition: Slide left/right (300ms)
5. Progress bar: Smooth width transition (per update)

---

## Accessibility

### WCAG 2.1 AA Compliance

**Color Contrast:**
- Text on white: Minimum 4.5:1
- Text on brand colors: Verified contrast ratios
- Interactive elements: Clear focus states

**Keyboard Navigation:**
- All interactive elements keyboard accessible
- Logical tab order
- Skip links for main content
- Focus indicators visible (2px solid brand-primary)

**Screen Readers:**
- Semantic HTML elements
- ARIA labels where needed
- Alt text for images
- Status announcements for dynamic content

**Touch Targets:**
- Minimum 44px × 44px
- Adequate spacing between targets (8px minimum)
- No overlapping interactive elements

---

## Implementation Plan

### Phase 1: Foundation (Week 1)
- Audit current code
- Create component library structure
- Set up brand color system
- Create base layout components
- Implement responsive grid system

### Phase 2: Main Dashboard (Week 2)
- Redesign header component
- Create welcome section
- Build stats cards grid
- Implement credit status card
- Create primary action card

### Phase 3: Individual Pages (Week 3)
- Redesign selfies page
- Redesign generations page
- Build generate flow
- Create step navigation system

### Phase 4: Integration & Polish (Week 4)
- Integrate all components
- Add animations and transitions
- Implement responsive breakpoints
- Accessibility audit and fixes
- Cross-browser testing
- Performance optimization

### Phase 5: Testing & Refinement (Week 5)
- User testing (internal)
- Bug fixes and refinements
- Mobile device testing
- Final accessibility audit
- Documentation updates

---

## Content & Copy Guidelines

### Tone
- **Professional with warmth**: "Welcome back, Sarah!" not "User dashboard"
- **Action-focused**: "Generate photos" not "Photo generation"
- **Clear outcomes**: "Good for 5 photos" not "Credits: 20"
- **Concise**: One idea per sentence, short paragraphs

### Voice
- **User perspective**: "You" and "your" (not "we" or "the user")
- **Exception**: When representing TeamShotsPro

### Examples

**Welcome Messages:**
- ✅ "Welcome to Acme Corp, Sarah! Upload your selfie and generate your professional team photo in under 60 seconds."
- ❌ "Welcome to the team photo generation dashboard. Please upload a selfie to begin."

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
- **Generation rate**: Monitor photos generated per invite
- **User satisfaction**: Collect feedback post-redesign
- **Conversion**: Track signup CTA clicks

---

## Key Design Decisions

### 1. Brand Color System
**Decision:** All colors must come from brand config, no hardcoded values.

**Rationale:** Ensures consistency across the application and makes rebranding easier.

**Implementation:** Use Tailwind classes (`bg-brand-primary`) or reference `BRAND_CONFIG.colors.primary` programmatically.

---

### 2. Mobile-First Approach
**Decision:** Design for mobile first, then enhance for desktop.

**Rationale:** Most team members access via mobile devices. Mobile-first ensures optimal experience for the majority.

**Implementation:** Start with single-column layouts, then add multi-column grids at larger breakpoints.

---

### 3. Step-Based Generate Flow
**Decision:** Break generation into 4 clear steps with progress indicator.

**Rationale:** Reduces cognitive load and guides users through the process systematically.

**Implementation:** Progress bar at top, step content in middle, navigation buttons at bottom.

---

### 4. Multi-Select Selfie Interface
**Decision:** Allow selecting multiple selfies (2+ required) for generation.

**Rationale:** Enables better photo quality by using multiple angles/expressions.

**Implementation:** Checkbox overlay on selfie thumbnails, selection banner showing count.

---

### 5. Before/After Comparison
**Decision:** Show side-by-side comparison with interactive slider.

**Rationale:** Helps users see the transformation and value of the service.

**Implementation:** Two images side-by-side (desktop), stacked (mobile), draggable slider between them.

---

## Component Checklist

### Main Dashboard
- [ ] Header component
- [ ] Welcome section
- [ ] Credit status card
- [ ] Stats grid
- [ ] Primary action card
- [ ] Recent photos gallery
- [ ] Signup CTA card

### Selfies Page
- [ ] Page header
- [ ] Selection info banner
- [ ] Selfie gallery grid
- [ ] Upload flow component
- [ ] Empty state

### Generations Page
- [ ] Page header
- [ ] Generation grid
- [ ] Generation card
- [ ] Before/after slider
- [ ] Action buttons
- [ ] Empty state

### Generate Flow
- [ ] Progress indicator
- [ ] Step 1: Select selfies
- [ ] Step 2: Customize style
- [ ] Step 3: Review & confirm
- [ ] Step 4: Generate progress
- [ ] Navigation buttons

---

## Next Steps

1. **Review Design Documents**
   - Review all design specifications
   - Approve aesthetic direction
   - Provide feedback on components

2. **Prioritize Implementation**
   - Decide on implementation order
   - Set up development environment
   - Create component library structure

3. **Begin Development**
   - Start with Phase 1: Foundation
   - Follow brand color system strictly
   - Test responsive breakpoints early

4. **Iterate & Refine**
   - Test with real users
   - Gather feedback
   - Refine based on usage patterns

---

## References

- [Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md)
- [Invite Dashboard Visual Spec](./INVITE_DASHBOARD_VISUAL_SPEC.md)
- [Invite Dashboard Pages Redesign](./INVITE_DASHBOARD_PAGES_REDESIGN.md)
- [Invite Dashboard Pages Visual Spec](./INVITE_DASHBOARD_PAGES_VISUAL_SPEC.md)
- [Dashboard Visual Spec](./DASHBOARD_VISUAL_SPEC.md)
- [Brand Config](../src/config/brand.ts)
- [Text Guidelines](../.cursor/rules/text_guidelines.mdc)
- [Frontend Design Principles](../.cursor/rules/frontend-design.mdc)

---

**Status:** Design phase complete. Ready for implementation review and approval.

