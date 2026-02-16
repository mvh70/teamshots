/**
 * Custom Clothing Prompt Builder
 *
 * Builds outfit-specific prompt text for AI generation
 */

import type { CustomClothingSettings } from './types'

const CUSTOM_CLOTHING_CONTRIBUTION_INSTRUCTIONS = [
  'The person must wear the exact clothing items shown in the garment collage reference image',
  'Match all visible clothing details: style, fit, patterns, and textures',
  'Ensure all garments are worn appropriately and naturally',
]

const CUSTOM_CLOTHING_CONTRIBUTION_MUST_FOLLOW = [
  'Use the garment collage as the PRIMARY reference for all garment styling and details.',
  'Replicate the EXACT appearance of the clothing shown in the collage - colors, patterns, logos, and all visible details are already correctly applied.',
  'CRITICAL: If garments in the collage have a logo on them, preserve this logo exactly as shown when dressing the person.',
  'When layering outer garments (jackets, blazers) over base layers, it is NATURAL and EXPECTED for the outer layer to partially cover or obscure parts of any logo.',
  'DO NOT attempt to move, relocate, or "save" the logo from being covered - realistic fabric layering means logos can be partially hidden by outer garments.',
  'The logo belongs to the base layer fabric - let outer layers fall naturally over it as they would in real clothing.',
  'The clothing in the collage is complete and final - do not modify, reinterpret, or add any elements.',
  'No duplicate accessories - only include items from collage once.',
  'DO NOT use any other reference images for clothing, branding, or logo information - the collage contains everything needed.',
]

const CUSTOM_CLOTHING_REFERENCE_DESCRIPTION =
  'GARMENT COLLAGE - Complete clothing reference showing all garments with accurate colors, patterns, branding, and styling. Use this as the definitive source for how the person should be dressed.'

const CUSTOM_CLOTHING_WARDROBE_INSTRUCTION =
  'CRITICAL: Dress the person EXACTLY as shown in the GARMENT COLLAGE reference image. The collage shows all clothing items extracted from the original outfit - replicate these items precisely on the person.'

const CUSTOM_CLOTHING_WARDROBE_FALLBACK_DESCRIPTION =
  'Professional outfit as shown in the garment collage reference image'

const CUSTOM_CLOTHING_GARMENT_ANALYSIS_INSTRUCTION =
  'Use the garmentAnalysis data in the wardrobe section for precise clothing details including item types, colors, materials, and layering information'

const GARMENT_DESCRIPTION_ANALYSIS_PROMPT = `Analyze this garment collage image and provide a detailed JSON description of all clothing items and accessories visible.

Return ONLY a valid JSON object with no markdown formatting, no code blocks, just the raw JSON.

The JSON must follow this exact structure:
{
  "items": [
    {
      "category": "outerwear" | "top" | "bottom" | "footwear" | "accessory",
      "type": "string (e.g., blazer, shirt, pants, sneakers, watch)",
      "color": {
        "primary": "string (main color)",
        "secondary": "string | null (accent color if any)",
        "pattern": "solid" | "striped" | "checkered" | "patterned" | "textured"
      },
      "material": "string | null (e.g., cotton, wool, leather, denim)",
      "style": "string (e.g., formal, casual, business-casual, sporty)",
      "fit": "string | null (e.g., slim, regular, loose, tailored)",
      "details": ["array of notable features like buttons, pockets, logos, embroidery"]
    }
  ],
  "overallStyle": "string (e.g., business professional, smart casual, formal)",
  "colorPalette": ["array of dominant colors in the outfit"],
  "layering": "string describing how items layer (e.g., 'blazer over button-up shirt')",
  "hasLogo": boolean,
  "logoDescription": "string | null (describe logo if present)"
}

Be precise and objective. Only describe items that are clearly visible in the collage.`

const GARMENT_COLLAGE_PROMPT_BASE = `Create a high-quality flat-lay garment collage from the attached outfit image.

GOAL: Extract and display ONLY the actual clothing items and accessories visible in the input image.

LAYOUT INSTRUCTIONS:
- Disassemble the outfit into its individual components.
- Count the distinct items first, then arrange ONLY that many items.
- If there are 1-2 items, arrange them side by side in a single row. Do NOT create a grid.
- If there are 3-4 items, use a 2x2 grid.
- If there are 5+ items, use a 2x3 or 3x3 grid.
- Each garment must fill its allocated space as much as possible - maximize the size of each item within its cell.
- Use a neutral background (white or light gray).
- Ensure even spacing and no overlaps.
- Each item must be clearly separated.
- Add a subtle drop shadow to give depth.
- Label each item with a clean, sans-serif text label next to it (e.g., "Jacket", "Shirt", "Pants").

CRITICAL RULES (ANTI-HALLUCINATION):
1. STRICT COUNT: Count the distinct clothing items in the source image. The output MUST contain EXACTLY that number of items - no more, no fewer.
2. NO DUPLICATES: Each physical item must appear EXACTLY ONCE. If you see 1 blazer in the source, show 1 blazer. If you see 1 shirt, show 1 shirt. Never repeat an item to fill space.
3. ONLY VISIBLE ITEMS: Do not invent items. If the person is not wearing a watch, do not add a watch. If you cannot see shoes, do not add shoes.
4. NO HUMAN PARTS: Do not include hands, feet, heads, or bodies. Only the inanimate clothing/accessories.
5. EXACT MATCH: The extracted items must look identical to the source (same color, pattern, texture, logo).
6. FILL THE FRAME: Each garment should be displayed as large as possible, using the full available space. Avoid small items floating in empty space.

ITEMS TO EXTRACT (ONLY IF VISIBLE):
- Outerwear (Jacket, Coat, Blazer) - if present
- Tops (Shirt, T-shirt, Sweater, Hoodie)
- Bottoms (Pants, Jeans, Shorts, Skirt)
- Footwear (One pair of shoes/boots) - IF VISIBLE
- Accessories (ONLY IF CLEARLY VISIBLE: Watch, Glasses, Hat, Bag, Belt, Scarf, Jewelry)
`

const GARMENT_COLLAGE_LOGO_BLOCK = `LOGO PLACEMENT (MANDATORY):
- You MUST place the provided logo on the primary top garment (Shirt/T-shirt/Hoodie).
- If there is an outer layer (Jacket), place the logo on the inner layer (Shirt) if visible, otherwise on the Jacket.
- Position the logo naturally on the chest area.
- It should look like it is printed or embroidered on the fabric.
`

const GARMENT_COLLAGE_PROMPT_STYLE_LINE = 'Style: Clean, commercial product photography.'

const CUSTOM_CLOTHING_OUTFIT_REFERENCE_DESCRIPTION = 'Outfit image to extract garments from'
const CUSTOM_CLOTHING_LOGO_REFERENCE_DESCRIPTION = 'Logo to place on garments'

/**
 * Build prompt text for custom clothing
 */
export function buildCustomClothingPrompt(settings: CustomClothingSettings): string {
  const value = settings.value
  
  // Only build prompt if there's an actual outfit set
  if (!value?.outfitS3Key && !value?.assetId) {
    return ''
  }

  const parts: string[] = []

  // If we have a description, use it as the primary guidance
  if (value.description) {
    parts.push(`The person should be wearing: ${value.description}.`)
  } else if (value.colors) {
    // Otherwise, build description from colors
    const colorParts: string[] = []

    if (value.colors.topLayer) {
      colorParts.push(`a ${value.colors.topLayer} colored outer garment (jacket/blazer/shirt)`)
    }

    if (value.colors.baseLayer) {
      colorParts.push(`with a ${value.colors.baseLayer} colored shirt underneath`)
    }

    if (value.colors.bottom) {
      colorParts.push(`${value.colors.bottom} colored pants/trousers`)
    }

    if (value.colors.shoes) {
      colorParts.push(`${value.colors.shoes} colored shoes`)
    }

    if (colorParts.length > 0) {
      parts.push(`The person should be wearing ${colorParts.join(', ')}.`)
    }
  }

  // Add general guidance for outfit matching
  if (value.assetId || value.outfitS3Key) {
    parts.push(
      'Match the style, fit, and overall appearance of the reference outfit provided.',
      'Pay close attention to collar style, sleeve length, garment fit, and any visible details.',
      'Ensure the clothing looks natural and professional.'
    )
  }

  return parts.join(' ')
}

export function getCustomClothingContributionInstructions(): string[] {
  return [...CUSTOM_CLOTHING_CONTRIBUTION_INSTRUCTIONS]
}

export function getCustomClothingContributionMustFollowRules(): string[] {
  return [...CUSTOM_CLOTHING_CONTRIBUTION_MUST_FOLLOW]
}

export function getCustomClothingReferenceDescription(): string {
  return CUSTOM_CLOTHING_REFERENCE_DESCRIPTION
}

export function getCustomClothingWardrobeInstruction(): string {
  return CUSTOM_CLOTHING_WARDROBE_INSTRUCTION
}

export function getCustomClothingWardrobeFallbackDescription(): string {
  return CUSTOM_CLOTHING_WARDROBE_FALLBACK_DESCRIPTION
}

export function getCustomClothingGarmentAnalysisInstruction(): string {
  return CUSTOM_CLOTHING_GARMENT_ANALYSIS_INSTRUCTION
}

export function buildGarmentDescriptionAnalysisPrompt(): string {
  return GARMENT_DESCRIPTION_ANALYSIS_PROMPT
}

export function buildGarmentCollagePrompt(hasLogo: boolean): string {
  const parts = [GARMENT_COLLAGE_PROMPT_BASE]
  if (hasLogo) {
    parts.push(GARMENT_COLLAGE_LOGO_BLOCK)
  }
  parts.push(GARMENT_COLLAGE_PROMPT_STYLE_LINE)
  return parts.join('\n\n')
}

export function getCustomClothingOutfitReferenceDescription(): string {
  return CUSTOM_CLOTHING_OUTFIT_REFERENCE_DESCRIPTION
}

export function getCustomClothingLogoReferenceDescription(): string {
  return CUSTOM_CLOTHING_LOGO_REFERENCE_DESCRIPTION
}
