# Face Detection Testing Guide

## Quick Testing Methods

### 1. Development Mode (Filename Simulation)

In development, face detection uses filename-based simulation for faster testing:

**Test Cases:**
- ✅ **Valid selfie**: Upload any image with a normal filename → Should allow upload
- ❌ **No face**: Rename image to include "no-face" or "noface" → Should reject with "No face detected"
- ❌ **Multiple faces**: Rename image to include "multiple" → Should reject with "Multiple faces detected"

**Example:**
```bash
# Rename your test images:
mv my-selfie.jpg my-selfie-no-face.jpg  # Will fail detection
mv my-selfie.jpg my-selfie-multiple.jpg # Will fail detection
```

### 2. Production/Actual BlazeFace Testing

To test the actual BlazeFace model, you need to either:
- Build for production: `npm run build && npm start`
- Or temporarily disable dev mode simulation (see below)

**Test Cases:**
1. **Valid single face** → Should upload successfully
2. **No face** (landscape, object, etc.) → Should show "No face detected"
3. **Multiple faces** (group photo) → Should show "Multiple faces detected"
4. **Different skin tones** → Should work for all (this was the main fix)
5. **Low light/quality images** → May still detect if face is visible

### 3. Browser Console Checks

Open browser DevTools (F12) and check:

**Model Loading:**
- First upload: Should see TensorFlow.js model downloading (~200KB)
- Subsequent uploads: Should use cached model (faster)

**Errors:**
- Check for any console errors during face detection
- Look for warnings like "Face detection failed" (should gracefully allow upload)

### 4. Network Tab Verification

1. Open DevTools → Network tab
2. Upload a selfie
3. Look for:
   - BlazeFace model files loading (first time only)
   - TensorFlow.js library chunks
   - Should see ~200KB download on first face detection

### 5. Testing Different Scenarios

**Test Images to Try:**
- ✅ Clear single-person selfie
- ✅ Professional headshot
- ✅ Casual selfie
- ✅ Close-up face photo
- ❌ Landscape photo (no face)
- ❌ Group photo (multiple faces)
- ❌ Object photo (no face)
- ✅ Different lighting conditions
- ✅ Different skin tones (this was the main improvement)

### 6. Force Real Detection in Development

If you want to test the actual BlazeFace model in development, temporarily modify `src/lib/face-detection.ts`:

```typescript
// Comment out or modify this check:
// if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
//   // ... simulation code
// }
```

Then restart your dev server.

### 7. Performance Testing

**First Detection:**
- Model load: ~1-2 seconds
- Detection: ~200-500ms
- Total: ~1.5-2.5 seconds

**Subsequent Detections:**
- Model cached: 0ms
- Detection: ~200-500ms
- Total: ~200-500ms

### 8. Edge Cases to Test

- Very large images (50MB limit)
- Very small images (< 100px)
- Unusual aspect ratios
- Images with filters/effects
- Rotated images (EXIF orientation)
- Corrupted image files (should handle gracefully)

## Expected Behavior

### ✅ Success Case
1. User selects image
2. Brief delay while detecting (~500ms after first load)
3. Image preview shows
4. Upload proceeds normally

### ❌ Failure Cases

**No Face:**
- Error message: "No face detected in the image. Please upload a photo with a clear face."
- Upload blocked
- User can try again

**Multiple Faces:**
- Error message: "Multiple faces detected in the image. Please upload a photo with only one face."
- Upload blocked
- User can try again

**Model Load Failure (Graceful Degradation):**
- Console warning: "Face detection failed"
- Upload still proceeds (backend will validate)
- This ensures users aren't blocked if detection fails

## Verification Checklist

- [ ] Single face selfie uploads successfully
- [ ] No-face image is rejected with clear error
- [ ] Multiple faces image is rejected with clear error
- [ ] Model loads on first detection (check Network tab)
- [ ] Model is cached for subsequent detections (faster)
- [ ] Works with different skin tones (main improvement)
- [ ] Works with different lighting conditions
- [ ] Graceful degradation if detection fails
- [ ] Console shows no errors
- [ ] Performance is acceptable (< 2s first time, < 500ms after)

## Debugging Tips

If detection isn't working:

1. **Check Console:**
   ```javascript
   // In browser console, you can manually test:
   import { validateSelfieFace } from '@/lib/face-detection'
   const file = /* your File object */
   const result = await validateSelfieFace(file)
   console.log(result)
   ```

2. **Check Model Loading:**
   - First upload should download ~200KB
   - Check Network tab for TensorFlow.js chunks

3. **Verify Environment:**
   - Development: Uses filename simulation
   - Production: Uses actual BlazeFace model

4. **Check for Errors:**
   - Look for "Face detection failed" warnings
   - Check if TensorFlow.js loads correctly
   - Verify browser supports WebGL (BlazeFace requirement)

