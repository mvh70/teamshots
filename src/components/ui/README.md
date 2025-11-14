# UI Components

This directory contains reusable UI components that eliminate code duplication across the application.

## Button Component

Replaces the 54+ instances of duplicated button classes throughout the codebase. Unified component supporting all button variants including auth, checkout, and loading states.

### Usage

```tsx
import {
  Button,
  PrimaryButton,
  SecondaryButton,
  DangerButton,
  AuthButton,
  CheckoutButton
} from '@/components/ui'

// Basic usage
<Button onClick={() => console.log('clicked')}>Click me</Button>

// Predefined variants
<PrimaryButton onClick={handleSubmit}>Submit</PrimaryButton>
<SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
<DangerButton onClick={handleDelete}>Delete</DangerButton>

// Auth button with loading (full width, auth styling)
<AuthButton loading={isLoading} onClick={handleSignIn}>
  Sign In
</AuthButton>

// Checkout button with sub-label and brand colors
<CheckoutButton
  subLabel="4 credits"
  useBrandCtaColors
  fullWidth
  onClick={handleCheckout}
>
  Start Free Trial
</CheckoutButton>

// Loading state
<Button variant="primary" loading loadingText="Processing...">
  Save Changes
</Button>
```

### Props

#### Core Props
- `variant`: 'primary' | 'secondary' | 'danger' | 'auth' | 'checkout' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'sm')
- `disabled`: boolean
- `onClick`: () => void
- `data-testid`: string (for testing)
- `type`: 'button' | 'submit' | 'reset' (default: 'button')

#### Loading State
- `loading`: boolean - Shows loading state
- `loadingText`: string - Custom loading text (defaults vary by variant)

#### Layout Options
- `fullWidth`: boolean - Makes button full width
- `className`: string - Additional CSS classes

#### Auth Variant Props
- Automatically full width with auth styling
- Loading text defaults to "Please wait…"

#### Checkout Variant Props
- `subLabel`: string - Secondary text below main label
- `useBrandCtaColors`: boolean - Use brand CTA colors with hover effects

## Loading Components

### LoadingSpinner

Replaces the 10+ instances of duplicated loading spinner patterns.

```tsx
import { LoadingSpinner, SmallLoadingSpinner, LargeLoadingSpinner } from '@/components/ui'

// Basic usage
<LoadingSpinner />

// Size variants
<SmallLoadingSpinner />
<LoadingSpinner size="md" />
<LargeLoadingSpinner />

// Custom styling
<LoadingSpinner className="text-blue-500" />
```

### LoadingState

Skeleton loading states for better UX during data loading.

```tsx
import { LoadingState, LoadingCard, LoadingGrid } from '@/components/ui'

// Basic skeleton
<LoadingState className="h-4 w-32" />

// Card skeleton
<LoadingCard />

// Grid skeleton
<LoadingGrid cols={3} rows={2} />
```

### ProgressBar

Upload progress and other progress indicators.

```tsx
import { ProgressBar } from '@/components/ui'

// Basic progress bar
<ProgressBar progress={75} />

// With custom text
<ProgressBar progress={50} text="Uploading..." />

// Hide text
<ProgressBar progress={25} showText={false} />
```

### ImagePreview

Consolidated image display component with loading states, error handling, and multiple variants.

```tsx
import {
  ImagePreview,
  ThumbnailImage,
  PreviewImage,
  FullImage,
  InteractiveImagePreview
} from '@/components/ui'

// Basic image preview with loading/error states
<ImagePreview
  src="/api/files/get?key=..."
  alt="Selfie"
  width={300}
  height={300}
/>

// Size variants
<ThumbnailImage src="..." alt="..." />
<PreviewImage src="..." alt="..." />
<FullImage src="..." alt="..." />

// Interactive image with overlay
<InteractiveImagePreview src="..." alt="...">
  <button className="absolute top-2 right-2">Delete</button>
</InteractiveImagePreview>

// Custom error message
<ImagePreview
  src="..."
  alt="..."
  errorMessage="Image failed to load"
/>
```

## Grid Component

Replaces the 15+ instances of duplicated responsive grid layouts.

### Usage

```tsx
import { Grid, UploadGrid, GenerationGrid, CardGrid } from '@/components/ui'

// Custom grid
<Grid cols={{ mobile: 2, tablet: 3, desktop: 4 }} gap="md">
  {items.map(item => <ItemCard key={item.id} item={item} />)}
</Grid>

// Predefined grids
<UploadGrid>{uploads.map(upload => <UploadCard key={upload.id} />)}</UploadGrid>
<GenerationGrid>{generations.map(gen => <GenerationCard key={gen.id} />)}</GenerationGrid>
<CardGrid>{cards.map(card => <Card key={card.id} />)}</CardGrid>
```

### Props

- `cols`: { mobile?: number, tablet?: number, desktop?: number }
- `gap`: 'sm' | 'md' | 'lg' (default: 'md')
- `data-testid`: string (for testing)

## Migration Guide

### Before (Duplicated Code)
```tsx
<button className="px-4 py-2 rounded-md bg-brand-primary text-white hover:bg-brand-primary-hover text-sm">
  Upload
</button>

<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {items.map(item => <Item key={item.id} />)}
</div>
```

### After (Reusable Components)
```tsx
<PrimaryButton>Upload</PrimaryButton>

<UploadGrid>
  {items.map(item => <Item key={item.id} />)}
</UploadGrid>
```

## Benefits

1. **Consistency**: All buttons and grids use the same styling
2. **Maintainability**: Changes to button/grid styles only need to be made in one place
3. **Accessibility**: Built-in focus states and proper button semantics
4. **Testing**: Consistent test IDs across all instances
5. **Performance**: Reduced bundle size by eliminating duplicate CSS classes
