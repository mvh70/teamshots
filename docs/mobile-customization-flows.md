# Mobile Customization Flows

This document captures the **current architecture** of the mobile "generation wizard" for the two user types TeamShots supports today:

* **Invited team-member** (invite-dashboard flow)
* **Logged-in user** (app/generate flow – personal or team)

It highlights the components involved, critical props/state that control behaviour, and recent fixes so future refactors don't re-introduce mismatches.

---

## 1. Routing overview

| Flow | Info pages | Selfie selection | Customization wizard |
|------|------------|------------------|----------------------|
| **Invited user** | `/invite-dashboard/[token]/selfie-tips` → `/invite-dashboard/[token]/customization-intro` | `/invite-dashboard/[token]/selfies` | **Inline inside `/invite-dashboard/[token]`** |
| **Logged-in user** | `/app/generate/selfie-tips` → `/app/generate/customization-intro` | `/app/generate/selfie` | **Inline inside `/app/generate/start`** |

Both wizards are **client-side only** and live inside the main dashboard/start pages.

---

## 2. Shell & Layout architecture

The biggest architectural difference between the two flows is the **outer shell**:

| Aspect | Invited flow | Logged-in flow |
|--------|--------------|----------------|
| **App shell** | None – standalone pages | `AppShell` (provides sidebar + app header) |
| **App header** | `InviteDashboardHeader` (custom) | `Header` from AppShell (non-sticky) |
| **Flow pages** | Use layout components directly | Nested inside AppShell's `<main>` |

Because `AppShell` provides its own header, the logged-in flow pages must coordinate their sticky headers carefully to avoid double-header issues.

---

## 3. Layout components

### FlowLayout

Used for **info pages** (selfie-tips, customization-intro). Provides:
- Optional sticky/fixed header via `header` prop
- Consistent spacing & max-width constraints
- Footer support

```tsx
<FlowLayout
  header={{
    kicker: 'Before you generate',
    title: 'Customize your headshots',
    showBack: true,
    onBack: handleBack
  }}
  maxWidth="2xl"
  background="white"
>
  <CustomizationIntroContent />
</FlowLayout>
```

When `header` prop is provided, the header becomes:
- **Fixed** on mobile (with spacer below)
- **Sticky** on desktop

### StickyFlowPage

Used for **selfie selection pages**. Wraps `ScrollAwareHeader` and provides:
- Dual-header support (top header + flow header)
- Scroll-aware header transitions
- Mobile spacer for fixed headers

```tsx
<StickyFlowPage
  topHeader={<InviteDashboardHeader />}   // Optional
  flowHeader={{ title: 'Select selfies', step: {...} }}
  fixedHeaderOnMobile                      // Makes header fixed vs sticky
  mobileHeaderSpacerHeight={96}
>
  <SharedMobileSelfieFlow ... />
</StickyFlowPage>
```

### ScrollAwareHeader

Handles sticky dual-header behaviour:
- Shows `top` header when at top of page
- Fades to `flowHeader` when user scrolls past threshold
- Supports `fixedOnMobile` for fixed positioning

### FlowHeader

The actual header component rendered inside the above wrappers:
- Kicker text (small uppercase branded text)
- Title + optional subtitle
- Step indicator (dots)
- Back button
- Right-side content slot

---

## 4. Core page components

| Concern | Invited flow | Logged-in flow |
|---------|--------------|----------------|
| **Main page component** | `InviteDashboardPage` | `StartGenerationClient` |
| **Customization wizard** | Direct JSX in `InviteDashboardPage` (via `StyleSettingsSection`) | `PhotoStyleSettings` component |
| **Selfie selection** | `/invite-dashboard/[token]/selfies/page.tsx` | `/app/generate/selfie/page.tsx` |
| **Step list construction** | `useCustomizationWizard` hook | `useCustomizationWizard` hook |
| **Editable vs locked detection** | `useCustomizationWizard` hook | `useCustomizationWizard` hook |
| **Generate-button rules** | `credits OK && ≥2 selfies && !customizationStillRequired && canGenerateFromWizard` | `credits OK && ≥2 selfies && !hasUneditedFields && canGenerateFromWizard` |

> **Key learning:** the invited flow builds its step list regardless of how many editable categories exist, whereas the logged-in flow originally hid locked categories until *after* an editable section was changed. This caused the mobile swipe layout to disappear when no edits were required.

---

## 5. Shared components

### SharedMobileSelfieFlow

Unified mobile layout for selfie selection across both flows:
- Scroll-aware info banner (fades on scroll)
- Selfie grid
- Navigation controls
- Floating status badge
- Pinned upload section

```tsx
<SharedMobileSelfieFlow
  canContinue={canContinue}
  infoBanner={<SelfieSelectionInfoBanner />}
  grid={<SelectableGrid ... />}
  navigation={<FlowNavigation ... />}
  uploadSection={<SelfieUploadFlow />}
  statusBadge={{ readyContent, selectingContent }}
/>
```

### SwipeableContainer

Detects horizontal swipe gestures for navigation:
```tsx
<SwipeableContainer
  onSwipeLeft={handleNext}
  onSwipeRight={handleBack}
  enabled={isSwipeEnabled}
>
  {children}
</SwipeableContainer>
```

### FlowNavigation

Step dots + prev/next buttons:
```tsx
<FlowNavigation
  variant="both"
  current={currentStep}
  total={totalSteps}
  onPrev={handleBack}
  onNext={handleNext}
  canGoNext={canContinue}
  stepColors={{ lockedSteps, visitedEditableSteps }}
/>
```

### IntroScreenContent

Shared content component for **info pages** (`selfie-tips`, `customization-intro`). Ensures both pages have identical visual styling, spacing, and interaction patterns.

**Key features:**
- **Variant system**: Supports `'swipe'` (mobile swipe flow) and `'button'` (desktop with continue button)
- **Content structure**: Header section (kicker, title, body), optional image, tips list, optional continue button
- **Tip types**: Tips can be either `'simple'` (single text string) or `'titled'` (title + description)
- **Visual consistency**: Both info pages use this component, ensuring identical card styling, animations, spacing, and typography

**Usage pattern:**
- `SelfieTipsContent` wraps `IntroScreenContent` with selfie-specific tips and an example image
- `CustomizationIntroContent` wraps `IntroScreenContent` with customization-specific tips (no image)
- Both pass the same props structure, maintaining visual consistency

> **Important**: When updating styling for info pages, modify `IntroScreenContent` rather than individual page components. This ensures both pages stay visually consistent.

---

## 6. Props / State that change behaviour

### PhotoStyleSettings (logged-in)

| Prop / State | Purpose |
|--------------|---------|
| `packageId` | Determines visible categories (from `pkg.visibleCategories`). Defaults to `headshot1` when no active context. |
| `originalContextSettings` | Snapshot of the context *before* user edits. Used to decide if a category is *predefined* vs *user-choice*. |
| `useCustomizationWizard` | **New Hook** encapsulating wizard logic. |
| `mobileSteps` | Derived from hook. |
| `canGenerate` (internal) | Derived from hook. Exposed via `onCanGenerateChange`. |

### InviteDashboardPage

| State | Purpose |
|-------|---------|
| `canGenerateFromWizard` | Boolean from `StyleSettingsSection` -> `PhotoStyleSettings` -> `useCustomizationWizard`. Replaces manual visitation tracking. |
| `customizationStillRequired` | `hasUneditedEditableFields(...)` computed against **team context**. |

---

## 7. Interaction with Photo Styles / Contexts

* **Active context present** → `originalContextSettings` populated with the context's deserialised UI settings.
* **No active context** → logged-in flow falls back to `headshot1` defaults **with all categories set to `user-choice`** (`makeAllFieldsEditable`).
* **Package defaults** → used both as UI starting point and as comparison when no context value exists.

| Scenario | Editable categories detected |
|----------|------------------------------|
| Team context that locks everything | `currentEditableCategories = []` (none) |
| Team context that leaves ClothingColors open | `[ 'clothingColors' ]` |
| No context (freestyle) | all package categories (`background`, `branding`, `clothing`, `clothingColors`, `pose`, `expression`) |

---

## 8. Recent Fixes

### 2025-12-02
1. **Locked categories always rendered** – `lockedSectionsVisible` set to `true`.
2. **Generate-button gating** – new `hasVisitedAllEditableSteps` ensures user must swipe through **all** editable cards.
3. **makeAllFieldsEditable helper** – when no active context, `headshot1` defaults are cloned with `user-choice` everywhere so editable steps exist.
4. **Responsive card wrapper** – card styling now `md:` only; mobile uses transparent background.

### 2025-12-03
5. **Sticky headers for logged-in users** – Info pages (`selfie-tips`, `customization-intro`) now pass `header` prop to `FlowLayout`, matching invite flow behavior.
6. **Fixed headers on selfie selection** – Added `fixedHeaderOnMobile` option to `StickyFlowPage` and `ScrollAwareHeader`. Logged-in selfie page now uses fixed header like invite flow.
7. **Mobile header spacer** – `mobileHeaderSpacerHeight` prop ensures content starts below fixed headers.
8. **Fixed header for customization wizard** – `PhotoStyleSettings` now uses fixed positioning for its mobile header instead of sticky, with a spacer div. This ensures the header stays visible at the top of the viewport regardless of nesting depth within AppShell.

### 2025-12-03 (Refactor)
9. **Consolidated Wizard Logic** – Extracted `useCustomizationWizard` hook. Used in `PhotoStyleSettings` (and thus `InviteDashboardPage`).
10. **CSS-first layout** – Removed JS `isMobile` checks for layout structure.
11. **Package Schema** – Added Zod validation script.

---

## 9. Testing matrix

| User Type | Context Present | Editable Cats | Expected first mobile card |
|-----------|-----------------|---------------|---------------------------|
| Invited team member | yes | depends on team admin | Selfie-tips → Editable cat or locked cat 1 |
| Logged-in personal | no | all | Background (editable) |
| Logged-in team admin | yes | 0 (admin locks) | Locked cat 1 |
| Logged-in team member | yes | e.g. clothingColors | ClothingColors (editable) |

All cases now render the swipe carousel; `Generate` remains disabled until the last card is visited and all gating conditions are met.

---

## 10. File reference

| File | Purpose |
|------|---------|
| `src/hooks/useCustomizationWizard.ts` | **New** Hook containing mobile wizard logic |
| `src/components/customization/PhotoStyleSettings.tsx` | Customization wizard component (uses hook) |
| `src/app/invite-dashboard/[token]/page.tsx` | Invite dashboard (uses PhotoStyleSettings) |
| `src/app/[locale]/app/generate/start/StartGenerationClient.tsx` | Start page (uses PhotoStyleSettings) |
| `scripts/validate-packages.ts` | **New** Package schema validation script |
| `src/domain/style/utils.ts` | **New** Utility for ensuring visible categories |

---

## 11. Future considerations

* **SSR detection** – current mobile detection is client-side; consider CSS-only rendering to avoid flash. (Partially addressed with CSS-first layout)
* **AppShell coordination** – consider whether generation flow should exit AppShell entirely for a more immersive mobile experience.
