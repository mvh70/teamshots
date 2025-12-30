/**
 * Generate clothing preview images for all style/detail combinations
 *
 * This script generates preview images for the ClothingSelector component.
 * Images are saved to public/images/clothing/{style}-{detail}.png
 *
 * Usage: npx tsx scripts/generate-clothing-previews.ts
 */

// Load environment variables
import { config } from 'dotenv'
config()

import { WARDROBE_DETAILS, generateWardrobePrompt } from '../src/domain/style/elements/clothing/prompt'
import type { KnownClothingStyle } from '../src/domain/style/elements/clothing/config'
import type { ClothingSettings } from '../src/types/photo-style'
import fs from 'fs/promises'
import path from 'path'

const WHITE_COLOR = '#FFFFFF'
const CHROMA_KEY_GREEN = '#00FF00' // Bright green for easy background removal

interface GenerationResult {
  style: string
  detail: string
  filename: string
  success: boolean
  error?: string
}

/**
 * Build prompt for clothing preview generation (without branding)
 */
function buildClothingPreviewPrompt(
  style: KnownClothingStyle,
  detail: string
): string {
  const clothing: ClothingSettings = {
    style,
    details: detail,
    accessories: []
  }

  const clothingColors = {
    type: 'predefined' as const,
    colors: {
      topLayer: WHITE_COLOR,
      baseLayer: WHITE_COLOR,
      bottom: WHITE_COLOR,
      shoes: WHITE_COLOR
    }
  }

  const wardrobeResult = generateWardrobePrompt({
    clothing,
    clothingColors,
    shotType: 'medium-shot'
  })

  const { descriptor, wardrobe } = wardrobeResult
  const isSingleLayer = !descriptor.outerLayer

  // Build layer descriptions
  const layerDescriptions: string[] = []

  if (wardrobe.top_layer) {
    const layerName = isSingleLayer ? 'Main garment' : 'Outer layer'
    layerDescriptions.push(`${layerName}: ${wardrobe.top_layer}`)
  }

  if (wardrobe.base_layer && !isSingleLayer) {
    layerDescriptions.push(`Base layer: ${wardrobe.base_layer}`)
  }

  // Add color specifications
  const colorPalette = wardrobe.color_palette as string[] | undefined
  if (colorPalette && colorPalette.length > 0) {
    layerDescriptions.push(`\nCOLOR SPECIFICATIONS:`)
    colorPalette.forEach(colorSpec => {
      layerDescriptions.push(`- ${colorSpec}`)
    })
  }

  layerDescriptions.push(`\nPants: Professional ${style === 'business' ? 'dress pants or trousers' : 'casual pants or chinos'} in ${WHITE_COLOR} color`)

  // Count garments
  const garmentCount = (wardrobe.top_layer ? 1 : 0) +
                       (wardrobe.base_layer && !isSingleLayer ? 1 : 0) +
                       1 // pants

  // Build layout requirements
  const layoutParts = [`STANDARDIZED LAYOUT REQUIREMENTS:
- Arrange items in a GRID layout on a clean white background with ALL items FULLY SEPARATED
- CRITICAL: NO overlapping - each garment must be completely visible with clear space between items
- CRITICAL: Show EXACTLY ${garmentCount} item(s) total - no more, no less`]

  if (isSingleLayer) {
    layoutParts.push(`- Main garment (${wardrobe.top_layer}) laid perfectly flat, facing forward, symmetrical, fully spread out, 100% visible`)
  } else {
    layoutParts.push(`- Base layer (${wardrobe.base_layer}) in its own space, 100% visible with no obstructions`)
    layoutParts.push(`- Outer layer (${wardrobe.top_layer}) in its own separate space, NOT touching or overlapping the base layer`)
  }

  layoutParts.push(`- Pants in their own separate space below, NOT touching upper garments`)
  layoutParts.push(`- Minimum 5cm spacing between ALL items - no parts of any garment should touch`)
  layoutParts.push(`- All items laid perfectly flat, facing forward, symmetrical, fully spread out`)
  layoutParts.push(`- Professional product catalog photography style showing each item individually`)
  layoutParts.push(`- Bright, flat studio lighting with ZERO shadows`)
  layoutParts.push(`- Each garment should be photographed as if it's a standalone product listing`)

  const layoutInstructions = layoutParts.join('\n')

  return `
CREATE A PROFESSIONAL CLOTHING TEMPLATE WITH CHROMA KEY BACKGROUND - ZERO SHADOWS:

You are creating a standardized flat-lay photograph showing clothing items on a bright green chroma key background for easy background removal.

⚠️ CRITICAL SHADOW PROHIBITION - READ CAREFULLY:
This image MUST have ABSOLUTELY ZERO SHADOWS of any kind. This is the #1 priority.
- NO shadows under the garments
- NO shadows around the garments
- NO shadows behind the garments
- NO shadows between the garments
- NO shadows ANYWHERE in the image
- NO drop shadows, cast shadows, ambient shadows, contact shadows, or any other type of shadow
- The garments must appear completely flat against the background as if painted on
- Use COMPLETELY FLAT lighting that eliminates ALL shadow formation
- Think: "zero gravity, zero depth, zero shadows, pure flat design"

CLOTHING ITEMS TO SHOW:
${layerDescriptions.map((layer, i) => `${i + 1}. ${layer}`).join('\n')}

${layoutInstructions}

BACKGROUND REQUIREMENTS - CRITICAL:
- Use BRIGHT GREEN chroma key background (RGB 0, 255, 0) - solid, uniform color
- NO gradients, NO variations in the green background color
- The green must be completely uniform across the entire background
- This green screen allows for easy background removal in post-processing

LIGHTING REQUIREMENTS - ABSOLUTELY CRITICAL:
- ZERO SHADOWS - This cannot be emphasized enough
- Use perfectly flat, frontal lighting that creates NO depth or dimension
- Imagine the garments are floating in zero gravity with omnidirectional lighting
- Every part of the garment should be equally lit
- The background should show NO darkening anywhere near the garments
- Think: "graphic design cutout" not "photograph with depth"
- NO 3D depth cues - make it look like a 2D illustration

CRITICAL QUALITY STANDARDS:
- Photorealistic fabric textures (cotton weave, wool texture, etc.)
- Sharp focus on all garments with crisp edges
- Clean separation between garments and green background
- NO color spill from the green background onto the white garments
- Professional product photography quality

ABSOLUTELY FORBIDDEN - VIOLATION WILL RESULT IN UNUSABLE IMAGE:
- ❌ DO NOT add shadows of ANY kind - this is non-negotiable
- ❌ DO NOT add drop shadows
- ❌ DO NOT add cast shadows
- ❌ DO NOT add ambient occlusion shadows
- ❌ DO NOT add contact shadows where garments meet the background
- ❌ DO NOT add any darkening or shading that creates depth
- ❌ DO NOT make the image look 3D or dimensional
- ❌ DO NOT add gradients to the background - keep it solid bright green
- ❌ DO NOT add creative styling or artistic interpretation
- ❌ DO NOT add text labels or annotations
- ❌ DO NOT show a person wearing the clothes
- ❌ DO NOT use any background color other than bright green (RGB 0, 255, 0)
- ❌ DO NOT overlap or layer garments on top of each other
- ❌ DO NOT arrange items in a way that hides any part of any garment
- ❌ DO NOT add logos or branding

FINAL VERIFICATION CHECKLIST:
Before generating, verify:
✓ Background is solid green (RGB 0, 255, 0) with no variations
✓ ZERO shadows anywhere in the image
✓ Garments look flat like graphic design cutouts
✓ No depth or 3D effect
✓ Clean, crisp edges on all garments
✓ Even lighting across entire image

OUTPUT SPECIFICATIONS:
- PNG image with solid bright green background (RGB 0, 255, 0)
- All garments in white/neutral tones with sharp, clean edges
- ZERO shadows - the image should look like a flat graphic design
- Garments should appear as if they were cut out and placed on green paper
- Ready for chroma key background removal
`.trim()
}

/**
 * Generate a single clothing preview image
 */
async function generateClothingImage(
  style: KnownClothingStyle,
  detail: string
): Promise<Buffer> {
  const prompt = buildClothingPreviewPrompt(style, detail)

  console.log(`\n📝 Prompt for ${style}-${detail}:`)
  console.log(prompt.substring(0, 500) + '...\n')

  // Import Gemini generator
  const { generateWithGemini } = await import('../src/queue/workers/generate-image/gemini')

  const result = await generateWithGemini(
    prompt,
    [], // No reference images
    '3:4', // Portrait aspect ratio
    undefined,
    { temperature: 0.2 }
  )

  if (!result.images || result.images.length === 0) {
    throw new Error('No image generated')
  }

  return result.images[0]
}

/**
 * Save image to public directory
 */
async function saveImage(
  imageBuffer: Buffer,
  style: string,
  detail: string
): Promise<string> {
  const publicDir = path.join(process.cwd(), 'public', 'images', 'clothing')
  await fs.mkdir(publicDir, { recursive: true })

  const filename = `${style}-${detail}.png`
  const filepath = path.join(publicDir, filename)

  await fs.writeFile(filepath, imageBuffer)

  return filename
}

/**
 * Main function
 */
async function main() {
  console.log('🎨 Clothing Preview Generator')
  console.log('================================\n')

  const results: GenerationResult[] = []
  let successCount = 0
  let errorCount = 0

  // Loop through all clothing styles
  for (const [style, details] of Object.entries(WARDROBE_DETAILS)) {
    console.log(`\n📂 Processing style: ${style}`)

    // Loop through all details for this style
    for (const detail of Object.keys(details)) {
      console.log(`  ⏳ Generating ${style}-${detail}...`)

      try {
        const imageBuffer = await generateClothingImage(
          style as KnownClothingStyle,
          detail
        )

        const filename = await saveImage(imageBuffer, style, detail)

        console.log(`  ✅ Saved: ${filename}`)

        results.push({
          style,
          detail,
          filename,
          success: true
        })

        successCount++

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`  ❌ Failed: ${errorMessage}`)

        results.push({
          style,
          detail,
          filename: `${style}-${detail}.png`,
          success: false,
          error: errorMessage
        })

        errorCount++
      }
    }
  }

  // Summary
  console.log('\n================================')
  console.log('📊 Generation Summary')
  console.log('================================')
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${errorCount}`)
  console.log(`📁 Total: ${results.length}`)

  // Show failed items
  if (errorCount > 0) {
    console.log('\n❌ Failed items:')
    results
      .filter(r => !r.success)
      .forEach(r => {
        console.log(`  - ${r.style}-${r.detail}: ${r.error}`)
      })
  }

  // Save results to file
  const resultsPath = path.join(process.cwd(), 'tmp', 'clothing-preview-results.json')
  await fs.mkdir(path.dirname(resultsPath), { recursive: true })
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2))
  console.log(`\n📄 Results saved to: ${resultsPath}`)
}

// Run
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
