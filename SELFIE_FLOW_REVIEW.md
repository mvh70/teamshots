# Selfie Flow Code Review - Complete Analysis

## Executive Summary

This review identified **6 major issues** in the selfie upload, approval, and representation flow:
1. **Duplicate upload flow implementation** in invite dashboard
2. **Unused `onReject` prop** in SelfieApproval component
3. **Duplicate success messages** (3 different implementations)
4. **Unused `continueUploading` prop** in SelfieUploadFlow
5. **Inconsistent component usage patterns** across pages
6. **Mobile vs Desktop code duplication** in invite dashboard

---

## 1. Duplicate Upload Flow Implementation

### Location
`src/app/invite-dashboard/[token]/selfies/page.tsx`

### Problem
This page implements a complete custom upload flow instead of using the reusable `SelfieUploadFlow` component:

**Custom Implementation:**
- Uses `PhotoUpload` directly (line 380)
- Uses `SelfieApproval` directly (lines 295, 391)
- Manages own state: `uploadKey`, `previewUrl`, `isApproved`, `forceCamera`
- Custom upload handler: `onUploadWithToken` (line 136) - uses `/api/uploads/proxy?token=...`
- Custom approval handler: `handleApprove` (line 158) - calls `/api/team/member/selfies`
- Custom reject/retake handlers (lines 229-237)
- Duplicate success message UI (lines 313-325 mobile, 408-420 desktop)

**Standard Implementation (used elsewhere):**
- Uses `SelfieUploadFlow` wrapper component
- Uses `useSelfieUpload` hook for state management
- Uses `/api/uploads/temp` → `/api/uploads/promote` flow
- Success message handled by `SelfieUploadFlow`

### Why It Exists
The invite dashboard needs token-based authentication (no user session):
- Uses `/api/uploads/proxy?token=...` instead of `/api/uploads/temp`
- Must call `/api/team/member/selfies` after upload to create DB record
- Needs different approval flow that doesn't use `/api/uploads/promote`

### Impact
- **Code duplication**: ~200 lines of duplicate logic
- **Inconsistent behavior**: Different error handling, state management
- **Maintenance burden**: Bug fixes must be applied in multiple places
- **Testing complexity**: Two different flows to test

### Recommendation
**Option A (Preferred)**: Refactor `SelfieUploadFlow` to support invite flows:
- Add `uploadEndpoint` prop to allow custom upload function (like `onUploadWithToken`)
- Keep `saveEndpoint` prop for post-approval processing (already exists)
- This would allow invite dashboard to use `SelfieUploadFlow` with custom endpoints

**Option B**: Extract shared logic into a hook that both implementations can use

---

## 2. Unused `onReject` Prop

### Location
`src/components/Upload/SelfieApproval.tsx`

### Problem
The component accepts `onReject` prop but **never uses it**:
- Defined in interface (line 11)
- Renamed to `_onReject` with eslint disable comment (line 21)
- No UI button or handler calls it
- No "Reject" button exists in the component

### Current Behavior
The component only has:
- **Approve & Continue** button (calls `onApprove`)
- **Retake Photo** button (calls `onRetake`)
- **Cancel** button (calls `onCancel`)

### Usage Analysis
All callers pass `onReject` handlers:
- `SelfieUploadFlow.tsx` line 122: `handleRejectWrapper` (wraps hook's `handleReject`)
- `invite-dashboard/[token]/selfies/page.tsx` lines 299, 395: `handleReject` (calls `deleteSelfie`)
- `invite-dashboard/[token]/page.tsx` line 882: `onReject` (calls `deleteSelfie`)
- `upload/page.tsx` line 168: `onReject` (calls `deleteSelfie`)

### Impact
- **Dead code**: Prop is accepted but never used
- **Confusing API**: Developers might expect reject functionality
- **Inconsistent**: Reject logic exists in hooks/pages but not exposed in UI

### Recommendation
**Option A**: Remove `onReject` prop entirely if reject functionality isn't needed
**Option B**: Add a "Reject" button to the UI if this functionality should exist
**Option C**: Keep prop for future use but document it's not currently used

---

## 3. Duplicate Success Messages

### Locations
1. `src/components/Upload/SelfieUploadFlow.tsx` lines 129-142
2. `src/app/invite-dashboard/[token]/selfies/page.tsx` lines 313-325 (mobile)
3. `src/app/invite-dashboard/[token]/selfies/page.tsx` lines 408-420 (desktop)

### Problem
Three different implementations of "Selfie Approved!" success message:

**Implementation 1** (`SelfieUploadFlow.tsx`):
```tsx
<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <div className="text-center">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-secondary-lighter mb-4">
      <svg>...</svg>
    </div>
    <h3 className="text-lg font-medium text-gray-900 mb-2">Selfie Approved!</h3>
    <p className="text-sm text-gray-600">Your selfie has been saved successfully.</p>
  </div>
</div>
```

**Implementation 2** (Mobile, invite dashboard):
```tsx
<div className="md:hidden bg-white border-b border-gray-200 px-4 py-4">
  <div className="text-center">
    <div className="mx-auto flex items-center justify-center h-10 w-10 rounded-full bg-brand-secondary/10 mb-3">
      <svg>...</svg>
    </div>
    <h3 className="text-base font-semibold text-gray-900 mb-1">Selfie Approved!</h3>
    <p className="text-xs text-gray-600">Your selfie has been saved successfully.</p>
  </div>
</div>
```

**Implementation 3** (Desktop, invite dashboard):
```tsx
<div className="hidden md:block bg-white rounded-lg shadow-sm border border-gray-200 p-6">
  <div className="text-center">
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-brand-secondary/10 mb-4">
      <svg>...</svg>
    </div>
    <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-2">Selfie Approved!</h3>
    <p className="text-sm text-gray-600">Your selfie has been saved successfully.</p>
  </div>
</div>
```

### Differences
- Different background colors: `bg-brand-secondary-lighter` vs `bg-brand-secondary/10`
- Different icon sizes: `h-12 w-12` vs `h-10 w-10` (mobile)
- Different text sizes: `text-lg` vs `text-base` (mobile) vs `text-lg md:text-xl` (desktop)
- Different spacing: `mb-4` vs `mb-3` (mobile), `mb-2` vs `mb-1` (mobile)
- Different container styles: rounded-lg with border vs border-b (mobile)

### Impact
- **Inconsistent UX**: Users see different success messages in different flows
- **Code duplication**: Same UI logic repeated 3 times
- **Maintenance burden**: Changes must be made in 3 places

### Recommendation
Extract to shared component: `SelfieUploadSuccess` or `UploadSuccessMessage`
- Single source of truth for success message UI
- Responsive by default (no separate mobile/desktop versions)
- Reusable across all flows

---

## 4. Unused `continueUploading` Prop

### Location
`src/components/Upload/SelfieUploadFlow.tsx`

### Problem
The `continueUploading` prop is defined and used internally but **never passed from any parent component**:

**Definition:**
```tsx
interface SelfieUploadFlowProps {
  continueUploading?: boolean // If true, don't show success message and continue showing upload interface
}

export default function SelfieUploadFlow({ ..., continueUploading = false }: SelfieUploadFlowProps)
```

**Internal Usage:**
- Line 43-52: Resets state when `continueUploading` becomes true
- Line 82-102: Shows upload interface if `continueUploading` is true
- Line 129: Hides success message if `continueUploading` is true

**Parent Component Usage:**
- `src/app/[locale]/app/generate/selfie/page.tsx` line 182: Not passed
- `src/app/[locale]/app/selfies/page.tsx` line 91: Not passed
- `src/app/[locale]/app/dashboard/page.tsx` line 586: Not passed
- `src/app/invite-dashboard/[token]/page.tsx` line 682: Not passed

### Impact
- **Dead code**: Feature exists but is never used
- **Confusion**: Developers might wonder what this prop does
- **Maintenance burden**: Code to maintain that serves no purpose

### Recommendation
**Option A**: Remove the prop and related logic if not needed
**Option B**: Document the prop and implement it where it would be useful (e.g., when user needs to upload multiple selfies in a row)

---

## 5. Inconsistent Component Usage Patterns

### Pattern 1: Using `SelfieUploadFlow` (Recommended)
**Pages:**
- `src/app/[locale]/app/generate/selfie/page.tsx` (line 182)
- `src/app/[locale]/app/selfies/page.tsx` (line 91)
- `src/app/[locale]/app/dashboard/page.tsx` (line 586)
- `src/app/invite-dashboard/[token]/page.tsx` (line 682)

**Benefits:**
- Consistent behavior
- Reusable logic in `useSelfieUpload` hook
- Centralized error handling
- Easier to maintain

### Pattern 2: Using `SelfieApproval` Directly
**Pages:**
- `src/app/invite-dashboard/[token]/selfies/page.tsx` (lines 295, 391)
- `src/app/invite-dashboard/[token]/page.tsx` (line 879)
- `src/app/[locale]/upload/page.tsx` (line 168)

**Issues:**
- Each page implements its own state management
- Duplicate approval/reject/retake logic
- Inconsistent error handling
- Harder to maintain

### Impact
- **Inconsistent patterns**: Makes codebase harder to understand
- **Maintenance burden**: Changes must be applied in multiple places
- **Bug risk**: Different implementations may have different bugs

### Recommendation
Standardize on `SelfieUploadFlow` where possible. For pages that need custom behavior:
- Use `saveEndpoint` prop for custom post-approval processing
- Use `uploadEndpoint` prop (if added) for custom upload logic
- Only use `SelfieApproval` directly if absolutely necessary

---

## 6. Mobile vs Desktop Duplication

### Location
`src/app/invite-dashboard/[token]/selfies/page.tsx`

### Problem
Separate implementations for mobile and desktop:

**Approval Screen:**
- Mobile: Lines 292-310 (`md:hidden`)
- Desktop: Lines 389-405 (`hidden md:block`)

**Success Message:**
- Mobile: Lines 313-325 (`md:hidden`)
- Desktop: Lines 408-420 (`hidden md:block`)

### Impact
- **Code duplication**: Same component rendered twice with different classes
- **Potential inconsistencies**: Mobile and desktop versions might diverge
- **Maintenance burden**: Changes must be made in two places

### Recommendation
Use responsive Tailwind classes instead of separate implementations:
- Single `SelfieApproval` component with responsive classes
- Single success message component with responsive classes
- Let Tailwind handle mobile/desktop differences

---

## API Endpoint Analysis

### Regular User Flow (Session-Based)
1. **Upload**: `POST /api/uploads/temp` → Returns `{ tempKey: "temp:filename" }`
2. **Approve**: `POST /api/uploads/promote` → Promotes temp file to S3, creates DB record, returns `{ key, selfieId }`
3. **Delete**: `DELETE /api/uploads/delete?key=...` → Deletes from S3 and DB

### Invite Dashboard Flow (Token-Based)
1. **Upload**: `POST /api/uploads/proxy?token=...` → Uploads directly to S3, returns `{ key }`
2. **Approve**: `POST /api/team/member/selfies` → Creates DB record with `{ token, selfieKey }`
3. **Delete**: `DELETE /api/uploads/delete?key=...` → Same as regular flow

### Differences
- **Upload**: Temp storage vs direct S3 upload
- **Approve**: Single endpoint (`promote`) vs two-step (`proxy` + `team/member/selfies`)
- **Delete**: Same endpoint (but invite flow doesn't require session)

### Consistency
✅ **Consistent**: Delete endpoint works for both flows
⚠️ **Inconsistent**: Upload/approve flow differs significantly

### Recommendation
The API differences are **intentional** due to authentication requirements:
- Regular flow: Requires session, uses temp storage for approval step
- Invite flow: Uses token, uploads directly to S3, creates DB record separately

This is acceptable, but the frontend should abstract these differences better.

---

## State Management Comparison

### `useSelfieUpload` Hook (Standard Flow)
**State:**
- `uploadedKey`: Current uploaded file key
- `isApproved`: Approval status
- `isLoading`: Loading state
- `pendingFile`: File object
- `tempKey`: Temporary storage key

**Flow:**
1. `handlePhotoUpload`: Upload to temp storage → set `tempKey`
2. `handlePhotoUploaded`: Set `uploadedKey` to temp key
3. `handleApprove`: Promote temp → set `uploadedKey` to final key, set `isApproved`
4. `handleReject`/`handleRetake`: Delete temp/final file, reset state

### Invite Dashboard (Custom Flow)
**State:**
- `uploadKey`: Current uploaded file key (or 'inline' for upload UI)
- `previewUrl`: Local preview URL
- `isApproved`: Approval status
- `forceCamera`: Force camera open on retake

**Flow:**
1. `onUploadWithToken`: Upload directly to S3 → set `uploadKey`
2. `handleUpload`: Set `uploadKey` and `previewUrl`
3. `handleApprove`: Create DB record → set `isApproved`, reset `uploadKey` conditionally
4. `handleReject`/`handleRetake`: Delete file, reset state

### Key Differences
- **Temp storage**: Standard flow uses temp, invite flow doesn't
- **State structure**: Different variable names (`uploadedKey` vs `uploadKey`)
- **Approval logic**: Standard promotes temp, invite creates DB record
- **Reset logic**: Invite flow has complex conditional reset based on mobile/generation flow

### Impact
- **Inconsistent patterns**: Makes code harder to understand
- **Bug risk**: Different state management may have different edge cases

---

## Summary of Recommendations

### High Priority
1. **Refactor invite dashboard to use `SelfieUploadFlow`** with custom endpoints
2. **Extract success message to shared component**
3. **Remove or implement `onReject` functionality**

### Medium Priority
4. **Remove `continueUploading` prop** if not needed
5. **Consolidate mobile/desktop implementations** using responsive classes
6. **Standardize state management** patterns

### Low Priority
7. **Document API endpoint differences** and when to use each
8. **Create shared types** for upload/approval state

---

## Files Requiring Changes

### Core Components
- `src/components/Upload/SelfieUploadFlow.tsx` - Add `uploadEndpoint` prop, remove `continueUploading`
- `src/components/Upload/SelfieApproval.tsx` - Remove or implement `onReject`
- `src/components/Upload/SelfieUploadSuccess.tsx` - **NEW** - Extract success message

### Pages
- `src/app/invite-dashboard/[token]/selfies/page.tsx` - Refactor to use `SelfieUploadFlow`
- `src/app/invite-dashboard/[token]/page.tsx` - Consider using `SelfieUploadFlow`

### Hooks
- `src/hooks/useSelfieUpload.ts` - Support custom upload endpoint

---

## Testing Considerations

After refactoring, ensure:
1. ✅ Regular user flow still works (temp → promote)
2. ✅ Invite dashboard flow still works (proxy → team/member/selfies)
3. ✅ Mobile and desktop views are consistent
4. ✅ Error handling works in both flows
5. ✅ Success messages appear correctly
6. ✅ Reject/retake functionality works (if implemented)

---

## Questions Answered

1. **Why does invite dashboard selfies page not use `SelfieUploadFlow`?**
   - Needs token-based authentication (no session)
   - Uses different API endpoints (`/api/uploads/proxy` + `/api/team/member/selfies`)
   - However, this could be abstracted with custom endpoint props

2. **Is `onReject` functionality intentionally disabled or just not implemented?**
   - Not implemented in UI - prop exists but no button calls it
   - Logic exists in hooks/pages but not exposed
   - Should either be removed or implemented

3. **Is `continueUploading` prop used in production or can it be removed?**
   - **Not used** - never passed from any parent component
   - Can be removed unless there's a planned use case

4. **Should success messages be extracted to a shared component?**
   - **Yes** - 3 different implementations cause inconsistency
   - Should be a single responsive component

5. **Are there any other selfie-related components or utilities not reviewed?**
   - `SelfieGallery` - Used for displaying selfies (not reviewed, seems fine)
   - `SelfieSelectionGrid` - Used for selection (not reviewed, seems fine)
   - `useSelfieSelection` - Hook for selection state (not reviewed, seems fine)

---

*Review completed: All todos finished. Ready for implementation planning.*

