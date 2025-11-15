# Invite Dashboard Mobile Optimization Guide

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Priority

---

## Overview

The invite dashboard is **optimized for mobile as the primary experience**. Desktop is an enhancement, not the base. This document outlines mobile-specific design decisions and implementation guidelines.

---

## Mobile-First Design Principles

### 1. Mobile is Primary, Desktop is Enhancement

**Philosophy:**
- Design every component for mobile first
- Test on mobile devices first
- Desktop features are enhancements, not requirements
- If it doesn't work well on mobile, it's not good enough

### 2. Touch-Optimized Interactions

**Touch Targets:**
- Minimum: 44px × 44px (Apple HIG)
- Preferred: 48px × 48px (Android Material)
- Primary actions: 56px+ (generate button, main CTAs)
- Spacing between targets: 12px minimum

**Thumb Zones:**
- Primary actions in bottom 2/3 of screen (natural thumb reach)
- Secondary actions in top 1/3
- Avoid actions in corners (hard to reach)
- Sticky buttons at bottom (always accessible)

### 3. Screen Real Estate

**Maximize Usable Space:**
- Reduced padding (16px instead of 24px)
- Compact header (56px instead of 80px)
- Single column layout (no side-by-side)
- Minimal whitespace (but still readable)
- Full-width components (buttons, cards)

**Above-the-Fold Priority:**
- Hero generate button visible without scrolling
- Key information (credits, team name) visible immediately
- Minimize scrolling required for primary actions

### 4. Performance

**Mobile Performance:**
- Fast load times (< 2 seconds first contentful paint)
- Optimized images (Next.js Image component)
- Lazy loading below fold
- Minimal JavaScript (progressive enhancement)
- Smooth animations (60fps target)

---

## Component Mobile Specifications

### Header (Mobile)

**Dimensions:**
- Height: 56px (compact)
- Padding: 12px vertical, 16px horizontal
- Single line layout (no wrapping)

**Content:**
- Back button: 44px × 44px (left)
- Team name: 16px, semibold (center/left)
- Credits: 14px, bold, brand-primary (right)

**Behavior:**
- Sticky on scroll
- Minimal shadow
- No subtitle on mobile

---

### Welcome Section (Mobile)

**Dimensions:**
- Padding: 24px vertical, 16px horizontal
- Compact height (don't dominate screen)

**Content:**
- Title: 24px, bold (reduced from 32px)
- Subtitle: 14px, regular (reduced from 18px)
- Short, punchy copy (mobile-optimized)

**Behavior:**
- Quick fade-in (300ms)
- Don't compete with generate button

---

### Hero Generate Button (Mobile)

**Dimensions:**
- Full width (100%, no margins)
- Minimum height: 88px (large touch target)
- Padding: 48px vertical, 24px horizontal
- Border radius: 16px

**Content:**
- Icon: 64px (reduced from 80px)
- Title: 18px, bold (reduced from 24px)
- Description: 14px, regular (reduced from 16px)
- Button text: 18px, semibold

**Behavior:**
- Sticky at bottom when scrolling
- Always accessible
- Haptic feedback on tap (if available)
- Active state (not hover)

**Position:**
- Bottom of viewport (sticky)
- Thumb-friendly zone
- Always visible

---

### Credit Status (Mobile)

**Dimensions:**
- Single line layout
- Padding: 12px vertical, 16px horizontal
- Compact card or inline with header

**Content:**
- Credits: 20px, bold, brand-primary
- "Good for X photos": 12px, text-muted
- Minimal, not dominant

---

### Recent Photos Gallery (Mobile)

**Dimensions:**
- 2-column grid (not 4)
- Thumbnail size: 80px × 80px
- Gap: 12px
- Max 4 thumbnails shown

**Content:**
- Compact title: 16px, semibold
- "View all" link: 14px, brand-primary
- Only shown if photos exist (no empty state)

**Behavior:**
- Lazy load images
- Swipe gestures (optional)
- Tap to view full size

---

### Integrated Generation Flow (Mobile)

**Layout:**
- Full-screen modal/overlay (not inline)
- Progress indicator: Dots at top (compact)
- Content: Scrollable area
- Generate button: Sticky at bottom

**Steps:**
1. Upload selfies (large drop zone, 300px min-height)
2. Select selfies (thumbnails, 2-column grid)
3. Style selection (accordion, compact)
4. Generate (progress bar, clear status)

**Touch Optimization:**
- Large upload zone (easy to tap)
- Large thumbnails (easy to select)
- Large generate button (always visible)
- Clear progress indicators
- Minimal scrolling

---

## Mobile-Specific Patterns

### 1. Sticky Actions

**Pattern:**
- Primary action (generate button) sticky at bottom
- Always accessible while scrolling
- Doesn't interfere with content
- Clear visual separation

**Implementation:**
```css
.generate-button {
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: white;
  padding-top: 16px;
  box-shadow: 0 -4px 6px rgba(0, 0, 0, 0.1);
}
```

---

### 2. Full-Width Components

**Pattern:**
- Buttons, cards, inputs full width on mobile
- No side margins (except screen edge padding)
- Maximizes usable space
- Easier to tap

**Implementation:**
```css
.component {
  width: 100%;
  padding-left: 16px;
  padding-right: 16px;
}

@media (min-width: 768px) {
  .component {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

### 3. Compact Typography

**Pattern:**
- Reduced font sizes on mobile
- Tighter line heights
- Shorter copy
- Mobile-optimized text

**Implementation:**
```css
.title {
  font-size: 28px; /* Mobile */
  line-height: 1.2;
}

@media (min-width: 768px) {
  .title {
    font-size: 32px; /* Desktop */
  }
}
```

---

### 4. Thumb-Friendly Zones

**Pattern:**
- Primary actions in bottom 2/3 of screen
- Secondary actions in top 1/3
- Avoid corners
- Large touch targets

**Zones:**
```
┌─────────────────────┐
│  Secondary Actions   │ ← Top 1/3
│  (Header, Info)      │
├─────────────────────┤
│                     │
│  Primary Content    │ ← Middle 1/3
│                     │
├─────────────────────┤
│  Primary Actions     │ ← Bottom 1/3
│  (Generate Button)  │
└─────────────────────┘
```

---

## Mobile Testing Checklist

### Layout
- [ ] Single column layout (no side-by-side)
- [ ] Full-width components
- [ ] Compact header (56px)
- [ ] Reduced padding (16px)
- [ ] Minimal scrolling required

### Touch Targets
- [ ] All buttons minimum 44px × 44px
- [ ] Primary buttons 56px+ height
- [ ] 12px spacing between targets
- [ ] No overlapping elements
- [ ] Thumb-friendly positioning

### Typography
- [ ] Reduced font sizes (mobile-optimized)
- [ ] Tighter line heights
- [ ] Shorter copy
- [ ] Readable on small screens

### Performance
- [ ] Fast load (< 2 seconds)
- [ ] Optimized images
- [ ] Lazy loading
- [ ] Smooth animations (60fps)
- [ ] No layout shift

### Interactions
- [ ] Sticky generate button
- [ ] Full-screen modals for flows
- [ ] Clear progress indicators
- [ ] Haptic feedback (if available)
- [ ] Active states (not hover)

### Accessibility
- [ ] WCAG AA contrast
- [ ] Keyboard navigation
- [ ] Screen reader support
- [ ] Focus indicators visible
- [ ] Touch targets accessible

---

## Breakpoint Strategy

### Mobile First Approach

**Base Styles (Mobile):**
```css
/* Mobile-first base styles */
.component {
  width: 100%;
  padding: 16px;
  font-size: 14px;
}
```

**Tablet Enhancement (768px+):**
```css
@media (min-width: 768px) {
  .component {
    padding: 24px;
    font-size: 16px;
  }
}
```

**Desktop Enhancement (1024px+):**
```css
@media (min-width: 1024px) {
  .component {
    max-width: 600px;
    margin: 0 auto;
    padding: 32px;
  }
}
```

---

## Common Mobile Patterns

### 1. Full-Screen Modal

**Use Case:** Generation flow, important forms

**Pattern:**
- Full-screen overlay
- Close button (top right, 44px)
- Scrollable content
- Sticky action button (bottom)

---

### 2. Bottom Sheet

**Use Case:** Quick actions, selections

**Pattern:**
- Slides up from bottom
- Dismissible by swipe down
- Compact, focused content
- Primary action at bottom

---

### 3. Sticky Button

**Use Case:** Generate button, primary CTAs

**Pattern:**
- Sticky at bottom of viewport
- Always accessible
- Clear visual separation
- Doesn't interfere with content

---

## Performance Optimization

### Images
- Use Next.js Image component
- Lazy load below fold
- Optimize formats (WebP, AVIF)
- Responsive sizes

### JavaScript
- Code splitting
- Lazy load components
- Minimize bundle size
- Progressive enhancement

### CSS
- Mobile-first media queries
- Avoid expensive properties (box-shadow, blur)
- Use transform/opacity for animations
- Minimize repaints

---

## Testing on Real Devices

### Devices to Test
- iPhone SE (small screen, 375px)
- iPhone 12/13/14 (standard, 390px)
- iPhone 14 Pro Max (large, 430px)
- Android phones (various sizes)
- iPad (tablet, 768px+)

### Test Scenarios
- First-time user flow
- Returning user flow
- Low credits scenario
- Generation flow
- Photo viewing
- Error states

### Performance Testing
- 3G connection
- 4G connection
- WiFi connection
- Slow device (older phones)
- Fast device (newest phones)

---

## References

- [Invite Dashboard Redesign](./INVITE_DASHBOARD_REDESIGN.md) - Main design document
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Guidelines](https://material.io/design)
- [Mobile-First Design Principles](https://www.lukew.com/ff/entry.asp?933)

---

**Status:** Mobile-first optimization is the primary design priority. All components should be designed and tested for mobile first.

