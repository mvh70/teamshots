# Sample Images Guide

This directory contains before/after transformation images for the gallery components.

## Current Status

✅ **Draggable slider implemented** - Users can drag to compare before/after  
✅ **User attribution system** - Shows real names and companies  
✅ **Hero gallery** - Large interactive demo in hero section  
⚠️ **Using Unsplash placeholders** - Replace with your actual AI transformations  

## How to Add Your Own Images

### Option 1: Quick Update (Recommended)

1. **Generate 3-6 before/after transformation pairs** using your AI
2. **Name them consistently:**
   ```
   /public/samples/before-1.jpg
   /public/samples/after-1.jpg
   /public/samples/before-2.jpg
   /public/samples/after-2.jpg
   /public/samples/before-3.jpg
   /public/samples/after-3.jpg
   ```

3. **Update the data in components:**
   - Edit `src/components/SampleGallery.tsx` - Update `SAMPLE_PHOTOS` array
   - Edit `src/components/HeroGallery.tsx` - Update `HERO_PHOTO` object

### Option 2: Using External URLs

Keep using URLs but update to your own:

```typescript
const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: '1',
    before: 'https://your-cdn.com/transformations/before-1.jpg',
    after: 'https://your-cdn.com/transformations/after-1.jpg',
    alt: 'Professional headshot transformation',
    attribution: {
      name: 'Real User Name',
      role: 'Their Job Title',
      company: 'Their Company'
    }
  }
];
```

## Image Requirements

### Technical Specs:
- **Format:** JPG or WebP (WebP preferred for smaller size)
- **Dimensions:** 800x800px minimum (square aspect ratio)
- **File Size:** Under 500KB per image (optimize with tools like TinyPNG)
- **Quality:** High resolution, well-lit, clear faces

### Content Guidelines:
- **Before:** Should look like casual photo (selfie, candid, informal)
- **After:** Should look professional (proper lighting, clean background, formal)
- **Faces:** Must show clear improvement in quality and professionalism
- **Diversity:** Include variety of ages, genders, ethnicities
- **Authenticity:** Real transformations build more trust than stock photos

## Generating Placeholder Images

### Temporary Testing (Current Method):
We're using Unsplash URLs which load real photos from their API:
```
https://images.unsplash.com/photo-[id]?w=600&h=600&fit=crop&auto=format
```

### Better Placeholder Services:
- **This Person Does Not Exist:** https://thispersondoesnotexist.com
- **Generated Photos:** https://generated.photos (paid but high quality)
- **Midjourney/DALL-E:** Generate realistic before/after pairs

## Creating Real Transformations

### Using Your Own AI:
1. Take/find casual professional photos
2. Run through your Gemini AI transformation
3. Save before/after pairs
4. Get permission from subjects if real people

### Best Practices:
- **Quality over quantity:** 3 excellent examples > 10 mediocre ones
- **Show variety:** Different backgrounds, outfits, ages
- **Real attribution:** Use real names only with permission
- **Consistent style:** All "after" images should have similar professional quality

## Component Locations

Files that use these images:

1. **HeroGallery** (`src/components/HeroGallery.tsx`)
   - Large single image in hero section
   - First thing visitors see
   - Use your BEST transformation here

2. **SampleGallery** (`src/components/SampleGallery.tsx`)
   - Grid of 3 examples
   - Section titled "See the Magic in Action"
   - Use diverse, high-quality examples

## Next Steps

1. ✅ Draggable slider working
2. ✅ Attribution system ready
3. ✅ Hero integration complete
4. ⏳ Replace Unsplash URLs with your transformations
5. ⏳ Get user permissions for attribution
6. ⏳ Optimize images for web
7. ⏳ Test on mobile devices

## Need Help?

- **Image optimization:** Use https://tinypng.com or https://squoosh.app
- **Image generation:** Use Midjourney, DALL-E, or your own AI
- **Stock photos:** Unsplash, Pexels (free with attribution)

---

**Remember:** The gallery is your #1 conversion tool. Great transformations = more signups!
