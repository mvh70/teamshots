# Generation Flow Refactor Guide

## ✅ Refactor Status: COMPLETED (Nov 2024)

### Implementation Summary
- Created unified layout components: `FlowLayout`, `FlowHeader`, `FlowFooter`, `StepIndicator`
- Created navigation components: `SwipeableContainer`, `FlowNavigation`
- Created unified grid: `SelectableGrid` (replaced SelfieGallery + SelfieSelectionGrid)
- Implemented route-based intro screens for both logged-in and invited users
- Removed legacy components: SelfieGallery, SelfieSelectionGrid, FlowIntroStep, MobileIntroWrapper, useIntroScreens

### New Routes
| Route | Purpose |
|-------|---------|
| `/app/generate/selfie-tips` | Selfie tips intro (logged-in users) |
| `/app/generate/customization-intro` | Customization intro (logged-in users) |
| `/invite-dashboard/[token]/selfie-tips` | Selfie tips intro (invited users) |
| `/invite-dashboard/[token]/customization-intro` | Customization intro (invited users) |

### Key Files
- Layout: `src/components/generation/layout/`
- Navigation: `src/components/generation/navigation/`
- Selection: `src/components/generation/selection/SelectableGrid.tsx`
- State: `src/hooks/useGenerationFlowState.ts`

---

## Overview

This document guides the complete refactoring of the generation flow codebase. The code has been developed and refactored multiple times, resulting in duplications, inconsistencies, and messy architecture. 

**Objective:** Consolidate all existing code into a clean, DRY, unified architecture using consistent components and patterns. No new functionality—everything needed already exists.

---

## Your Role

You are an expert frontend architect specializing in:
- Component-driven development
- DRY (Don't Repeat Yourself) principle
- Code consolidation and refactoring
- Clean, maintainable architecture

**Approach:** Work interactively. Analyze, ask clarifying questions, propose solutions, and implement incrementally. Never assume—always verify understanding before making changes.

---

## Application Context

### User Types & Entry Points

| User Type | Entry Point | Authentication |
|-----------|-------------|----------------|
| Logged-in (individual or team-admin) | `/app/dashboard` | Session-based |
| Invited user | `/invite/[token]` | Token-based |

### Viewport Behaviors

| Viewport | Header | Footer | Navigation |
|----------|--------|--------|------------|
| Mobile / Small screens | Sticky header with title + step indicator (on scroll) | Sticky action buttons | Swipe gestures |
| Desktop / Large screens | Standard header with title + step indicator | Inline buttons | Click actions |

**Note:** Info pages (Steps 2 & 4) do NOT show the step indicator.

---

## Flow Specification

### Step 1: Entry
- **Source:** Dashboard (logged-in) or Invited Dashboard (token user)
- **Action:** User clicks "Start Generation"

### Step 2: Selfie Info Page
- Informational screen explaining selfie requirements
- **Mobile:** Sticky header on scroll, sticky "Next" button at bottom
- **Desktop:** Standard layout with "Next" button
- **Navigation:** Swipe left (mobile) or click "Next" (desktop)

### Step 3: Selfie Selection
Core functionality:
- Display grid of existing selfies
- Each selfie can be selected/deselected by tapping/clicking

**Camera Capture Sub-flow:**
1. Opens as fullscreen overlay
2. User captures photo
3. Shows acceptance screen with three options:
   - **Accept:** Saves selfie, auto-selects it, returns to selection
   - **Retake:** Returns to camera viewfinder
   - **Cancel:** Discards, returns to selection
4. If camera access denied: Show info screen with instructions to grant access

**File Upload Sub-flow:**
1. Opens native file picker (multiple files allowed)
2. Shows "Processing X files" overlay during upload
3. On complete: Returns to selection, uploaded selfies are auto-selected

**Layout differences:**
- **Mobile:** Camera/Upload buttons in sticky bottom bar
- **Desktop:** Camera/Upload buttons in placeholder area beside selfie grid

### Step 4: Customization Info Page
- Informational screen explaining customization options
- Same layout pattern as Step 2 (info page variant)

### Step 5: Customization
Content:
- Editable customization options (shown first)
- Clothing color options (shown after editable options)

**Mobile behavior:**
- Show one option at a time
- Swipe through options sequentially
- Sticky "Generate" button at bottom
- Button disabled until: all editable options customized AND clothing colors viewed

**Desktop behavior:**
- All options visible in single view
- Editable options displayed first
- "Generate" button (same activation rules)

### Step 6: Generate
- Trigger the generation process

---

## Refactoring Process

### Phase 1: Discovery & Analysis

**Task:** Thoroughly analyze the existing codebase before proposing any changes.

1. **Map the codebase**
   - Identify all files involved in the generation flow
   - Document the current component hierarchy
   - Note the existing naming conventions and patterns

2. **Identify duplications**
   - Find repeated logic across components
   - Find similar components that could be unified
   - Find inconsistent implementations of the same feature

3. **Catalog existing patterns**
   - How is viewport detection currently handled?
   - How is navigation (swipe/click) currently implemented?
   - How are overlays/modals structured?
   - What state management patterns are used?

4. **Document edge cases**
   - What error states are handled?
   - What boundary conditions exist?
   - What loading states are implemented?

**Output:** Present findings and ask clarifying questions before proceeding.

---

### Phase 2: Consolidation Plan

**Task:** Propose a unified architecture based on Phase 1 findings.

1. **Define unified components**
   - List components to be created/consolidated
   - Specify which existing components each replaces
   - Define clear responsibilities for each

2. **Establish patterns**
   - Propose consistent patterns for:
     - Viewport-responsive behavior
     - Navigation (swipe vs click)
     - Sticky elements
     - Overlays and modals
     - Loading and error states

3. **Plan the migration**
   - Order of component consolidation
   - Dependencies between components
   - Risk assessment for each change

**Output:** Present the plan and get approval before implementing.

---

### Phase 3: Implementation

**Task:** Execute the consolidation incrementally.

For each component/change:
1. Explain what will be changed and why
2. Show the proposed code
3. Highlight any decisions or trade-offs
4. Wait for confirmation before proceeding

**Principles:**
- Follow existing project conventions (file structure, naming, styling)
- Maintain all existing functionality exactly
- Create self-contained, reusable components
- Minimize breaking changes during migration
- Keep commits/changes atomic and reversible

---

## Component Categories to Consider

Based on the flow requirements, these are the likely categories for consolidation:

### Layout Components
- Flow container with viewport awareness
- Sticky header (with/without step indicator variants)
- Sticky footer for mobile actions
- Step indicator display

### Navigation Components
- Swipeable container wrapper
- Unified navigation buttons (Next/Back/Continue)
- Navigation controller (abstracts swipe vs click)

### Page Templates
- Info page template (Steps 2 & 4)
- Selection page template (Step 3)
- Customization page template (Step 5)

### Overlay Components
- Base overlay/modal component
- Camera capture overlay
- Acceptance screen (Accept/Retry/Cancel pattern)
- Processing indicator overlay
- Permission request screen

### Selection Components
- Selectable grid container
- Selectable item (with selected/unselected states)

### Customization Components
- Customization option (mobile carousel item / desktop grid item)
- Option group container

---

## Working Agreement

1. **Ask before assuming** — If anything is unclear, ask for clarification
2. **Show before changing** — Present proposed changes before implementing
3. **Incremental progress** — Small, verifiable steps over large rewrites
4. **Preserve functionality** — Every refactor must maintain existing behavior
5. **Follow conventions** — Match existing project patterns and styles

---

## Getting Started

Begin by asking me to share the relevant code files. Then proceed with Phase 1 analysis.

**Suggested first questions:**
- Which files contain the generation flow components?
- Where is the entry point for logged-in vs invited users?
- Where are the current viewport/responsive utilities?