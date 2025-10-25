# UI Components

This directory contains reusable UI components that eliminate code duplication across the application.

## Button Component

Replaces the 54+ instances of duplicated button classes throughout the codebase.

### Usage

```tsx
import { Button, PrimaryButton, SecondaryButton, DangerButton } from '@/components/ui'

// Basic usage
<Button onClick={() => console.log('clicked')}>Click me</Button>

// Predefined variants
<PrimaryButton onClick={handleSubmit}>Submit</PrimaryButton>
<SecondaryButton onClick={handleCancel}>Cancel</SecondaryButton>
<DangerButton onClick={handleDelete}>Delete</DangerButton>

// Custom variants
<Button variant="primary" size="lg" disabled={isLoading}>
  Loading...
</Button>
```

### Props

- `variant`: 'primary' | 'secondary' | 'danger' (default: 'primary')
- `size`: 'sm' | 'md' | 'lg' (default: 'sm')
- `disabled`: boolean
- `onClick`: () => void
- `data-testid`: string (for testing)

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
