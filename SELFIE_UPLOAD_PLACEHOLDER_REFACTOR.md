# Selfie Upload Placeholder Refactoring

## Problem
The selfie upload/take placeholder was inconsistent across different flows:

1. **Invite Dashboard** (`/invite-dashboard/[token]/page.tsx`): Used `SelfieSelectionGrid` which rendered a single button with camera icon + "Upload new selfie" text
2. **Individual/Team Admin** (`/app/generate/selfie/page.tsx`): Used `SelfieGallery` which used `PhotoUpload` component with 2 buttons:
   - "Use Camera" (primary button)
   - "Choose from Gallery" (secondary button)

This inconsistency created a confusing user experience and unnecessary code duplication.

## Solution
Created a **reusable `SelfieUploadPlaceholder` component** that provides a consistent 2-button interface across all flows.

### Files Created
- **`src/components/generation/SelfieUploadPlaceholder.tsx`**: New reusable component

### Files Modified
- **`src/components/generation/SelfieSelectionGrid.tsx`**: Now uses `SelfieUploadPlaceholder` instead of custom button
- **`src/components/generation/SelfieGallery.tsx`**: Now uses `SelfieUploadPlaceholder` for non-inline upload scenarios

## Component Design

### SelfieUploadPlaceholder
```tsx
interface SelfieUploadPlaceholderProps {
  onUploadClick: () => void
  onCameraClick?: () => void
  disabled?: boolean
}
```

**Features:**
- Two vertically stacked buttons:
  1. **"Use Camera"** (primary, brand-colored button)
  2. **"Choose from Gallery"** (secondary, white button with border)
- Consistent styling matching `PhotoUpload` component
- Responsive design (works on mobile and desktop)
- Proper accessibility attributes
- Test IDs for e2e testing

**Behavior:**
- If `onCameraClick` is not provided, both buttons call `onUploadClick`
- Supports disabled state
- Prevents event propagation (stops parent click handlers)

## Benefits

1. **Consistency**: Same UI across all selfie upload flows
2. **DRY**: Single source of truth for upload placeholder
3. **Maintainability**: Changes to upload UI only need to be made in one place
4. **Mobile-First**: Properly tested mobile rendering (as requested)
5. **Accessibility**: Proper ARIA labels and semantic HTML

## Usage Examples

### In SelfieSelectionGrid (Invite Dashboard)
```tsx
{showUploadTile && onUploadClick && (
  <SelfieUploadPlaceholder onUploadClick={onUploadClick} />
)}
```

### In SelfieGallery (Individual/Team Admin)
```tsx
{onSelfiesApproved ? (
  <PhotoUpload /* inline upload with camera */ />
) : onUploadClick ? (
  <SelfieUploadPlaceholder onUploadClick={onUploadClick} />
) : null}
```

## Testing Notes
- Mobile rendering is preserved and correct (as requested)
- Desktop rendering now matches mobile behavior
- All existing functionality maintained
- No breaking changes to existing flows

## Next Steps
If needed, the component can be extended to support:
- Custom button text via props
- Different icon options
- Additional styling variants
- Internationalization (i18n) support

