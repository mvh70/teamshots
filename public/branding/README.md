# Brand Assets

This folder contains all brand-specific assets for TeamShots.

## Files

- **logo-light.svg** - Logo for use on light backgrounds (placeholder)
- **logo-dark.svg** - Logo for use on dark backgrounds (placeholder)
- **icon.svg** - App icon/favicon source (placeholder)
- **favicon.ico** - Browser favicon (to be generated from icon.svg)
- **og-image.jpg** - Social media preview image 1200x630px (to be created)

## Placeholders

The current SVG files are **placeholder designs** for MVP development.

For production:
1. Replace these with professional brand assets
2. Generate favicon.ico from icon.svg using a tool like https://realfavicongenerator.net/
3. Create og-image.jpg (1200x630px) for social media previews

## Usage

All brand assets are referenced through `@/config/brand.ts`, making them easy to update globally.

```typescript
import { BRAND_CONFIG } from '@/config/brand';

// Access logo paths
const logo = BRAND_CONFIG.logo.light;
const icon = BRAND_CONFIG.logo.icon;
```

## Changing Brand Assets

1. Replace the SVG/image files in this folder
2. No code changes needed - paths are in config/brand.ts
3. Ensure filenames match those in `BRAND_CONFIG.logo`

