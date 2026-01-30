# Preset Example Images

This directory contains example images for the standard shot presets. These images are displayed in the preset selector UI to help users visualize what each preset will look like.

## Image Requirements

- **Format**: PNG or JPG
- **Dimensions**: 400x300 pixels (or similar 4:3 aspect ratio)
- **File naming**: Lowercase preset ID with underscores replaced by hyphens
- **Quality**: High-quality example images that showcase the preset style

## Required Images

The following preset images should be added to this directory:

### Currently Enabled (will show image preview)
- `linkedin_neutral_studio.png` - LinkedIn profile optimized clean studio shot
- `linkedin_modern_office.png` - Contemporary office setting for LinkedIn
- `dating_lifestyle_cafe.png` - Warm café setting for dating profiles
- `cv_minimalist_white.png` - Clean minimalist background for CVs

### Future/Additional Presets (optional)
- `dating_outdoor_golden_hour.png` - Natural outdoor golden hour lighting
- `personal_brand_urban_creative.png` - Urban creative setting for personal branding

## How to Add a New Preset Image

1. Create a high-quality example image (400x300px recommended)
2. Save it with the lowercase preset ID as filename (e.g., `linkedin_neutral_studio.png`)
3. Place it in `/public/images/presets/`
4. Update `PRESETS_WITH_IMAGES` array in `/src/domain/style/elements/preset/PresetSelector.tsx`:

```typescript
const PRESETS_WITH_IMAGES = [
  'LINKEDIN_NEUTRAL_STUDIO',
  'LINKEDIN_MODERN_OFFICE',
  'DATING_LIFESTYLE_CAFE',
  'CV_MINIMALIST_WHITE',
  'YOUR_NEW_PRESET_ID' // Add your new preset here
] as const
```

## Technical Details

Images are loaded using the `ImagePreview` component with:
- Lazy loading disabled (`priority={true}`)
- Unoptimized mode (`unoptimized={true}`)
- Full-width responsive sizing
- Rounded borders with shadow

The selector automatically checks if an image exists before trying to display it.
