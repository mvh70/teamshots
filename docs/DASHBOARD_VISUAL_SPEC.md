# Dashboard Visual Layout Specification

**Version:** 1.0  
**Date:** January 2025  
**Status:** Design Phase

---

## Layout Overview

### Individual User Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Welcome back, Sarah! 👋                                         │ │
│  │  You've generated 12 professional photos. Ready to create more?  │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ 💎 Credits   │  │ 📸 Photos    │  │ 📄 Templates  │              │
│  │              │  │              │  │              │              │
│  │  120         │  │  12           │  │  3            │              │
│  │  credits     │  │  generated   │  │  active      │              │
│  │              │  │              │  │              │              │
│  │  12 gens     │  │  +2 this mo  │  │  +1 this mo  │              │
│  │              │  │              │  │              │              │
│  │ [Buy more →] │  │              │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Quick Actions                                                     │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  │    📸             │  │    📄            │  │    🖼️         │ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  │ Generate Photos  │  │ Create Template  │  │ View Library │ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘ │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Team Admin Dashboard

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Welcome back, Alex! 👋                                           │ │
│  │  Your team has generated 47 professional photos this month.      │ │
│  │  12 team members are ready to create more.                       │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │ 👥 Team      │  │ 📸 Photos     │  │ 📄 Templates  │  │ 💎 Used  ││
│  │              │  │              │  │              │  │          ││
│  │  12          │  │  47           │  │  2            │  │  470      ││
│  │  members     │  │  generated    │  │  active      │  │  credits  ││
│  │              │  │              │  │              │  │          ││
│  │  +2 this mo  │  │  +12 this mo  │  │  +1 this mo  │  │  +120 mo  ││
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘│
│                                                                         │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────┐│
│  │  Recent Activity                 │  │  Pending Team Invites       ││
│  ├──────────────────────────────────┤  ├─────────────────────────────┤│
│  │                                 │  │                            ││
│  │  ✓  Sarah generated 4 photos   │  │  John Doe                   ││
│  │     [Team] 2 hours ago          │  │  john@example.com           ││
│  │                                 │  │  Sent 2 days ago            ││
│  │  ⏱  John's generation           │  │  [Pending] [Resend]         ││
│  │     processing [Team]           │  │                            ││
│  │     5 minutes ago               │  │  ────────────────────────  ││
│  │                                 │  │                            ││
│  │  ✓  You generated 4 photos     │  │  [+ Invite team member]     ││
│  │     [Personal] 1 day ago        │  │                            ││
│  │                                 │  │                            ││
│  └──────────────────────────────────┘  └─────────────────────────────┘│
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │  Quick Actions                                                     │ │
│  ├───────────────────────────────────────────────────────────────────┤ │
│  │                                                                   │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  │    📸             │  │    📄            │  │    👥         │ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  │ Generate Photos  │  │ Create Template  │  │ Manage Team   │ │ │
│  │  │                  │  │                  │  │              │ │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────┘ │ │
│  │                                                                   │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Component Specifications

### Welcome Section

**Dimensions:**
- Width: 100% (full container width)
- Height: Auto (min-height: 120px)
- Padding: 32px vertical, 24px horizontal
- Border radius: 12px

**Background:**
- Gradient: `linear-gradient(to right, #6366F1, #4F46E5)`
- Text color: White (#FFFFFF)

**Typography:**
- Title: 24px, font-weight: 700, line-height: 1.2
- Subtitle: 16px, font-weight: 400, line-height: 1.5
- Opacity: 0.95 (subtitle)

**Spacing:**
- Title margin-bottom: 8px
- Content padding: 24px

---

### Stats Card

**Dimensions:**
- Width: 100% (responsive grid)
- Min-height: 140px
- Padding: 24px
- Border radius: 12px

**Visual:**
- Background: White (#FFFFFF)
- Border: 1px solid #E5E7EB (gray-200)
- Shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.1)`
- Hover shadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1)`

**Layout:**
```
┌─────────────────────┐
│  [Icon]  Label      │  ← Icon: 40×40px, bg: #EEF2FF
│                     │     Label: 14px, #6B7280
│  120                │  ← Value: 32px, #111827, bold
│  credits            │  ← Unit: 14px, #6B7280
│                     │
│  +12 this month     │  ← Change: 12px, #10B981
│  [Buy more →]       │  ← CTA: 14px, #EA580C
└─────────────────────┘
```

**Icon Container:**
- Size: 40px × 40px
- Background: #EEF2FF (brand-primary-light)
- Border radius: 10px
- Icon: 24px, #6366F1 (brand-primary)

**Value Display:**
- Font size: 32px (2rem)
- Font weight: 700
- Color: #111827 (text-dark)
- Line height: 1.2

**Change Indicator:**
- Font size: 12px
- Color: #10B981 (brand-secondary) for positive
- Format: "+X this month" or "+X"

---

### Recent Activity Item

**Layout:**
```
┌─────────────────────────────────────┐
│  ✓  Sarah generated 4 photos        │  ← Status icon: 20px
│     [Team] 2 hours ago              │  ← Badge: 12px pill
│                                     │  ← Timestamp: 12px, muted
└─────────────────────────────────────┘
```

**Spacing:**
- Item padding: 16px vertical
- Icon margin-right: 12px
- Gap between items: 16px

**Status Icons:**
- Completed: CheckCircleIcon, 20px, #10B981
- Processing: ClockIcon, 20px, #6366F1
- Pending: ClockIcon, 20px, #EA580C

**Generation Type Badge:**
- Padding: 4px 8px
- Border radius: 12px (full pill)
- Font size: 11px
- Font weight: 500
- Personal: bg #EEF2FF, text #6366F1
- Team: bg #10B981/10, text #10B981

---

### Quick Action Card

**Dimensions:**
- Width: 100% (responsive grid)
- Min-height: 120px
- Padding: 32px vertical, 24px horizontal
- Border radius: 12px

**Visual:**
- Background: White (#FFFFFF)
- Border: 1px solid #E5E7EB
- Shadow: `0 1px 3px 0 rgba(0, 0, 0, 0.1)`
- Hover: Shadow `0 10px 15px -3px rgba(0, 0, 0, 0.1)`, scale 1.02

**Layout:**
```
┌─────────────────────┐
│                     │
│      [Icon]         │  ← Icon: 48px, #6366F1
│                     │
│   Action Label      │  ← Label: 16px, #111827, semibold
│                     │
└─────────────────────┘
```

**Primary Action (Generate Photos):**
- Background: #EA580C (brand-cta)
- Text/Icon: White (#FFFFFF)
- Slightly larger: min-height 140px

---

### Pending Invite Item

**Layout:**
```
┌─────────────────────────────────────┐
│  John Doe                            │  ← Name: 14px, #111827, semibold
│  john@example.com                    │  ← Email: 12px, #6B7280
│  Sent 2 days ago                     │  ← Date: 12px, #9CA3AF
│  [Pending] [Resend]                  │  ← Badge + Action
└─────────────────────────────────────┘
```

**Spacing:**
- Item padding: 16px vertical
- Gap between items: 16px
- Divider: 1px solid #E5E7EB

**Status Badge:**
- Background: #EEF2FF
- Text: #6366F1
- Padding: 4px 10px
- Border radius: 12px
- Font size: 11px

**Resend Button:**
- Text link style
- Color: #6366F1
- Hover: #4F46E5, underline

---

## Responsive Breakpoints

### Mobile (< 640px)
```
┌─────────────────────┐
│  Welcome Section     │
├─────────────────────┤
│  ┌───────────────┐  │
│  │  Credits Card  │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Photos Card  │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Templates Card│  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │  Activity     │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Quick Actions │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Tablet (640px - 1024px)
```
┌─────────────────────────────────────┐
│  Welcome Section                     │
├─────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐       │
│  │ Credits  │  │  Photos   │       │
│  └──────────┘  └──────────┘       │
│  ┌──────────┐                      │
│  │Templates │                      │
│  └──────────┘                      │
│  ┌──────────────┐  ┌────────────┐ │
│  │  Activity    │  │  Invites   │ │
│  └──────────────┘  └────────────┘ │
│  ┌──────────┐  ┌──────────┐       │
│  │ Generate │  │ Template │       │
│  └──────────┘  └──────────┘       │
└─────────────────────────────────────┘
```

### Desktop (> 1024px)
```
┌─────────────────────────────────────────────────────────┐
│  Welcome Section                                         │
├─────────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐              │
│  │Team  │  │Photos│  │Templ.│  │Credits│              │
│  └──────┘  └──────┘  └──────┘  └──────┘              │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐  ┌─────────────────────────┐ │
│  │  Recent Activity     │  │  Pending Invites        │ │
│  └──────────────────────┘  └─────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Generate │  │ Template │  │  Manage   │            │
│  └──────────┘  └──────────┘  └──────────┘            │
└─────────────────────────────────────────────────────────┘
```

---

## Color Usage Map

### Primary Actions
- **Generate Photos Button**: #EA580C (brand-cta)
- **Primary Links**: #6366F1 (brand-primary)
- **Hover States**: #4F46E5 (brand-primary-hover)

### Status Indicators
- **Success/Completed**: #10B981 (brand-secondary)
- **Processing**: #6366F1 (brand-primary)
- **Pending**: #EA580C (brand-cta)

### Backgrounds
- **Page Background**: #F9FAFB (bg-gray-50)
- **Card Background**: #FFFFFF (bg-white)
- **Welcome Gradient**: #6366F1 → #4F46E5
- **Icon Backgrounds**: #EEF2FF (brand-primary-light)

### Text Colors
- **Primary Text**: #111827 (text-dark)
- **Body Text**: #374151 (text-body)
- **Muted Text**: #6B7280 (text-muted)
- **White Text**: #FFFFFF (on colored backgrounds)

---

## Spacing Reference

### Section Spacing
- Between major sections: 32px (xl)
- Between cards in grid: 24px (lg)
- Card internal padding: 24px (lg)

### Component Spacing
- Welcome section padding: 32px vertical, 24px horizontal
- Stats card padding: 24px
- Activity item padding: 16px vertical
- Quick action card padding: 32px vertical, 24px horizontal

### Element Spacing
- Icon to text: 12px
- Title to subtitle: 8px
- Value to unit: 4px
- Items in list: 16px

---

## Typography Scale

### Headings
- **H1 (Welcome Title)**: 24px, 700, 1.2 line-height
- **H2 (Section Headers)**: 20px, 600, 1.3 line-height
- **H3 (Card Titles)**: 16px, 600, 1.4 line-height

### Body Text
- **Large**: 16px, 400, 1.6 line-height
- **Regular**: 14px, 400, 1.5 line-height
- **Small**: 12px, 400, 1.4 line-height

### Special Cases
- **Stats Value**: 32px, 700, 1.2 line-height
- **Badge Text**: 11px, 500, 1.2 line-height
- **Timestamp**: 12px, 400, 1.4 line-height

---

## Interaction States

### Hover States
- **Cards**: Shadow increase, scale 1.02, border color change
- **Buttons**: Background color darken, shadow increase
- **Links**: Color change, underline (where appropriate)

### Focus States
- **All Interactive Elements**: 2px solid #6366F1 outline, 2px offset
- **Keyboard Navigation**: Clear focus indicators

### Active States
- **Buttons**: Slight scale down (0.98), then return
- **Cards**: Shadow decrease during click

### Loading States
- **Skeleton Loaders**: Pulse animation, gray-200 background
- **Spinners**: Rotating animation, brand-primary color

---

## Empty States

### No Activity
```
┌─────────────────────────────────────┐
│                                     │
│            [Icon]                   │
│                                     │
│      No recent activity             │
│                                     │
│  Activity will appear here once     │
│  you start generating photos.       │
│                                     │
└─────────────────────────────────────┘
```

### No Invites
```
┌─────────────────────────────────────┐
│                                     │
│            [Icon]                   │
│                                     │
│      No pending invites             │
│                                     │
│  Invite team members to get started │
│                                     │
│      [+ Invite team member]         │
│                                     │
└─────────────────────────────────────┘
```

**Visual Treatment:**
- Icon: 48px, #9CA3AF (muted)
- Text: 14px, #6B7280 (muted)
- CTA button: Primary style, centered

---

## Animation Timings

### Page Load
- Welcome section: 300ms fade + slide up
- Stats cards: 100ms stagger (each card 100ms after previous)
- Content sections: 400ms fade in

### Interactions
- Card hover: 200ms ease-out
- Button click: 100ms scale down, 100ms scale up
- Modal open: 300ms fade + scale

### State Changes
- Color transitions: 200ms ease
- Success message: 300ms slide down + fade

---

## Accessibility Specifications

### Focus Indicators
- **Width**: 2px solid
- **Color**: #6366F1 (brand-primary)
- **Offset**: 2px from element edge
- **Border radius**: Match element radius

### Color Contrast
- **Body Text**: 4.5:1 minimum (all text meets this)
- **Large Text**: 3:1 minimum (headings meet this)
- **Interactive Elements**: 3:1 minimum

### Touch Targets
- **Minimum Size**: 44px × 44px
- **Spacing**: 8px minimum between targets

---

## Implementation Notes

### CSS Classes Structure
```css
/* Welcome Section */
.dashboard-welcome {
  background: linear-gradient(to right, var(--brand-primary), var(--brand-primary-hover));
  color: white;
  padding: 2rem 1.5rem;
  border-radius: 0.75rem;
}

/* Stats Card */
.dashboard-stat-card {
  background: white;
  border: 1px solid #E5E7EB;
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 200ms ease-out;
}

.dashboard-stat-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  transform: scale(1.02);
}

/* Activity Item */
.dashboard-activity-item {
  padding: 1rem 0;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
```

### Tailwind Classes
- Use Tailwind utility classes where possible
- Leverage brand color classes from config
- Maintain consistent spacing scale
- Use responsive prefixes (sm:, md:, lg:)

---

## Quality Checklist

### Visual Design
- [ ] All colors from brand config (no hardcoded values)
- [ ] Consistent spacing scale throughout
- [ ] Typography hierarchy clear and consistent
- [ ] Icons properly sized and colored
- [ ] Shadows and borders subtle and consistent

### Responsive Design
- [ ] Mobile layout tested (< 640px)
- [ ] Tablet layout tested (640px - 1024px)
- [ ] Desktop layout tested (> 1024px)
- [ ] Touch targets adequate on mobile
- [ ] Text readable at all sizes

### Interactions
- [ ] Hover states work on all interactive elements
- [ ] Focus states visible and clear
- [ ] Animations smooth and purposeful
- [ ] Loading states provide feedback
- [ ] Empty states helpful and actionable

### Accessibility
- [ ] Color contrast meets WCAG AA
- [ ] Keyboard navigation works throughout
- [ ] Screen reader labels present
- [ ] Focus indicators visible
- [ ] Reduced motion respected

---

**End of Visual Specification**

