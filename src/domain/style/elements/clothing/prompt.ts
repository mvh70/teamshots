import type {
  ClothingColorSettings,
  ClothingColorValue,
  ShotTypeValue
} from '@/types/photo-style'
import type { ClothingValue } from './types'
import type { KnownClothingStyle, WardrobeDetailConfig } from './config'
import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import { getColorDisplay, getColorHex, type ColorValue } from '@/domain/style/elements/clothing-colors/types'
import { hasValue } from '../base/element-types'

/**
 * Details that don't require a top cover layer
 */
export const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'dress', 'gown', 'jumpsuit'])

/**
 * Fallback detail for each clothing style when no detail is specified
 */
export const FALLBACK_DETAIL_BY_STYLE: Record<KnownClothingStyle, string> = {
  business: 'formal',
  startup: 't-shirt',
  'black-tie': 'suit'
}

/**
 * Complete wardrobe descriptors for all clothing styles and details
 * Contains AI prompt descriptions, layering info, and UI exclusions
 */
export const WARDROBE_DETAILS: Record<KnownClothingStyle, Record<string, WardrobeDetailConfig>> = {
  business: {
    formal: {
      details: 'Tailored business suit ensemble with clean lines.',
      baseLayer: 'crisp dress shirt with subtle sheen',
      outerLayer: 'structured suit jacket fastened with a single button',
      notes: 'Pressed fabrics and polished appearance suitable for boardroom settings.',
      inherentAccessories: ['belt'] // Belt is standard for suit trousers
    },
    casual: {
      details: 'High-end business-casual ensemble with modern styling. Do NOT add a tie, pocket square, or lapel pin unless specifically listed in the accessories section.',
      baseLayer: 'A deluxe T-Shirt. Substantial and refined, like Mercerized cotton, Pima cotton, or modal blends, with a tight crew neck',
      outerLayer: 'A single-breasted jacket with a classic and refined touch',
      notes: 'Maintain relaxed but refined posture.',
      inherentAccessories: ['belt'] // Belt is standard for business casual trousers
    },
    blouse: {
      details: 'Polished blouse paired with tailored trousers or skirt',
      baseLayer: 'silk or satin blouse',
      outerLayer: 'structured blazer framing the neckline',
      notes: 'Keep jewelry minimal and ensure blouse remains smooth.',
      inherentAccessories: ['belt'] // Belt optional but authorized for trousers/skirt
    },
    dress: {
      details: 'Structured sheath dress with a corporate-ready silhouette',
      baseLayer: 'form-fitting dress bodice',
      notes: 'Optional lightweight blazer may be draped over shoulders.',
      excludeClothingColors: ['baseLayer']
      // No inherentAccessories - dresses typically don't require a belt
    },
    pantsuit: {
      details: 'Contemporary tailored pantsuit with defined waist',
      baseLayer: 'sleek camisole or blouse beneath the suit jacket',
      outerLayer: 'matching blazer worn slightly open to reveal the base layer',
      notes: 'Maintain sharp creases and refined tailoring for an authoritative look.',
      inherentAccessories: ['belt'] // Belt is standard for pantsuit trousers
    }
  },
  startup: {
    't-shirt': {
      details: 'Modern startup look centered around a fitted crewneck tee',
      baseLayer: 'well-fitted crewneck t-shirt',
      notes: 'Keep silhouette clean and wrinkle-free; no outer layer required.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Belt is standard for casual trousers/jeans
    },
    hoodie: {
      details: 'Casual startup hoodie outfit with relaxed confidence',
      baseLayer: 'premium hoodie',
      notes: 'Hood down, sleeves neat; keep presentation polished despite casual tone.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Belt is standard for casual trousers/jeans
    },
    polo: {
      details: 'Smart casual polo ensemble',
      baseLayer: 'tailored short-sleeve polo with structured collar',
      notes: 'Buttons neat, collar crisp to balance relaxed and professional cues.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Belt is standard for smart casual trousers
    },
    'button-down': {
      details: 'Casual button-down shirt worn open over a t-shirt',
      baseLayer: 'fitted t-shirt',
      outerLayer: 'lightweight button-down shirt worn open to frame the base layer',
      notes: 'Button-down sleeves can be crisp or subtly rolled; keep base layer visible.',
      excludeClothingColors: [],
      inherentAccessories: ['belt'] // Belt is standard for casual trousers
    },
    blouse: {
      details: 'Relaxed blouse with tailored trousers or midi skirt',
      baseLayer: 'flowy blouse',
      notes: 'Keep fabric smooth and opt for rolled sleeves to maintain an approachable tone.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Belt is standard for trousers or skirt
    },
    cardigan: {
      details: 'Layered cardigan over a clean base garment',
      baseLayer: 'minimal knit dress or tee beneath the cardigan',
      outerLayer: 'open-front cardigan draped naturally',
      notes: 'Keep cardigan edges neat and balanced.',
      excludeClothingColors: [],
      inherentAccessories: ['belt'] // Belt may be visible with trousers underneath
    },
    dress: {
      details: 'Casual startup dress with a streamlined silhouette',
      baseLayer: 'knee-length knit dress',
      notes: 'Avoid busy patterns for a clean, professional look.',
      excludeClothingColors: ['baseLayer']
    },
    jumpsuit: {
      details: 'Modern startup jumpsuit with tailored bodice',
      baseLayer: 'structured jumpsuit torso',
      notes: 'Define the waist with a belt and keep accessories minimal.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Explicitly mentioned in notes
    }
  },
  'black-tie': {
    tuxedo: {
      details: 'Classic black-tie tuxedo ensemble',
      baseLayer: 'pleated dress shirt with bow tie and subtle studs',
      outerLayer: 'satin-lapel tuxedo jacket fastened at the top button',
      notes: 'Include pocket square or lapel pin if colors are provided.',
      inherentAccessories: ['belt', 'cufflinks'] // Standard for formal tuxedo
    },
    suit: {
      details: 'Polished evening suit presentation',
      baseLayer: 'dress shirt with coordinating tie or bow tie',
      outerLayer: 'tailored suit jacket with structured shoulders',
      notes: 'Maintain sleek, pressed silhouette.',
      inherentAccessories: ['belt', 'cufflinks'] // Standard for formal suit
    },
    dress: {
      details: 'Elegant evening dress suitable for black-tie events',
      baseLayer: 'floor-length formal dress with structured bodice',
      notes: 'Focus on graceful draping and refined fabrication.',
      excludeClothingColors: ['baseLayer']
    },
    gown: {
      details: 'Floor-length evening gown with dramatic draping',
      baseLayer: 'sleek gown bodice',
      notes: 'Pair with refined accessories; keep fabric smooth and well-draped.',
      excludeClothingColors: ['baseLayer']
    },
    jumpsuit: {
      details: 'Sophisticated formal jumpsuit',
      baseLayer: 'structured jumpsuit bodice',
      notes: 'Accentuate with statement belt or jewelry while maintaining a polished silhouette.',
      excludeClothingColors: ['baseLayer'],
      inherentAccessories: ['belt'] // Explicitly mentioned in notes as statement belt
    }
  }
}

export interface WardrobePromptInput {
  clothing?: ClothingValue | null
  clothingColors?: ClothingColorSettings | null
  shotType?: ShotTypeValue | null
}

export interface WardrobePromptResult {
  styleKey: KnownClothingStyle
  detailKey: string
  descriptor: WardrobeDetailConfig
  wardrobe: Record<string, unknown>
}

const isFullBodyVisible = (shotType?: ShotTypeValue | null) =>
  shotType === 'full-body' || shotType === 'full-length' || shotType === 'wide-shot'

const isBottomVisible = (shotType?: ShotTypeValue | null) =>
  isFullBodyVisible(shotType) || shotType === 'midchest' || shotType === 'three-quarter'

/**
 * Check if shot type may partially show bottom garments
 * These are "edge case" shots where the frame cuts near the waistline,
 * so trousers/skirts might be partially visible even though not intended.
 */
const mayPartiallyShowBottom = (shotType?: ShotTypeValue | null) =>
  shotType === 'medium-shot' // Waist-level cut - trousers may be partially visible

const normalizeStyle = (style?: string | null): KnownClothingStyle => {
  const normalized = style?.toLowerCase?.() ?? ''
  if (normalized === 'business' || normalized === 'startup' || normalized === 'black-tie') {
    return normalized
  }
  return 'startup'
}

const normalizeDetail = (detail: string | undefined, styleKey: KnownClothingStyle): string => {
  if (detail && detail.trim().length > 0) {
    return detail.toLowerCase()
  }
  return FALLBACK_DETAIL_BY_STYLE[styleKey]
}

const resolveWardrobeDescriptor = (
  styleKey: KnownClothingStyle,
  detailKey: string
): WardrobeDetailConfig => {
  const styleDetails = WARDROBE_DETAILS[styleKey]
  const descriptor = styleDetails[detailKey]
  if (descriptor) {
    return descriptor
  }

  if (styleKey === 'business') {
    return {
      details: 'Polished business attire',
      baseLayer: 'crisp dress shirt suitable for subtle branding',
      outerLayer: 'tailored blazer worn neatly',
      notes: 'Maintain corporate-ready finish.'
    }
  }
  if (styleKey === 'startup') {
    return {
      details: 'Relaxed startup wardrobe',
      baseLayer: 'clean, logo-ready base top',
      notes: 'Keep the presentation casual but professional.'
    }
  }
  return {
    details: 'Refined formalwear',
    baseLayer: 'elegant formal garment suited to black-tie events',
    notes: 'Ensure upscale evening aesthetic.'
  }
}

const buildColorPalette = (
  colors: ClothingColorValue | undefined,
  detailKey: string,
  descriptor: WardrobeDetailConfig,
  shotType?: ShotTypeValue | null
): string[] | undefined => {
  if (!colors) return undefined
  const palette: string[] = []

  // Detect if this is a single-layer or multi-layer garment
  const isSingleLayer = !descriptor.outerLayer

  // Top layer - the visible outer garment (always present)
  if (colors.topLayer) {
    const colorValue = getColorDisplay(colors.topLayer)
    palette.push(`top_layer (${detailKey}): ${colorValue} color`)
  }

  // Base layer - shirt underneath (ONLY for multi-layer garments)
  if (colors.baseLayer && !isSingleLayer) {
    const colorValue = getColorDisplay(colors.baseLayer)
    palette.push(`base_layer (shirt underneath): ${colorValue} color`)
  }

  if (colors.bottom && isBottomVisible(shotType)) {
    // Fully visible - include color as primary specification
    const colorValue = getColorDisplay(colors.bottom)
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colorValue} color`)
  } else if (colors.bottom && mayPartiallyShowBottom(shotType)) {
    // Edge case: shot cuts near waistline - bottom may be partially visible
    // Include color as fallback to ensure consistency if AI shows any trousers
    const colorValue = getColorDisplay(colors.bottom)
    palette.push(`bottom garment if partially visible (trousers, skirt): ${colorValue} color`)
  }

  if (colors.shoes && isFullBodyVisible(shotType)) {
    const colorValue = getColorDisplay(colors.shoes)
    palette.push(`shoes (dress shoes, loafers, heels): ${colorValue} color`)
  }

  return palette.length > 0 ? palette : undefined
}

export function generateWardrobePrompt({
  clothing,
  clothingColors,
  shotType
}: WardrobePromptInput): WardrobePromptResult {
  const styleKey = normalizeStyle(clothing?.style ?? clothing?.type ?? undefined)
  const detailKey = normalizeDetail(clothing?.details, styleKey)
  const descriptor = resolveWardrobeDescriptor(styleKey, detailKey)

  const wardrobe: Record<string, unknown> = {
    style: clothing?.style ?? styleKey,
    style_key: styleKey, // Store normalized style for branding lookup
    detail_key: detailKey, // Store detail key for branding lookup
    details: descriptor.details
  }

  // For single-layer garments (no outerLayer), the baseLayer is semantically the top layer
  // For multi-layer garments (has outerLayer), keep both layers
  if (descriptor.outerLayer) {
    wardrobe.top_layer = descriptor.outerLayer
    wardrobe.base_layer = descriptor.baseLayer
  } else {
    wardrobe.top_layer = descriptor.baseLayer
  }
  if (descriptor.notes) {
    wardrobe.notes = descriptor.notes
  }
  if (clothing?.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
    wardrobe.accessories = clothing.accessories
  }

  // Add inherent accessories from the wardrobe descriptor
  // These are accessories naturally part of this clothing style (e.g., belt for business trousers)
  // They are authorized in the evaluator and won't be rejected as "unauthorized accessories"
  // IMPORTANT: Filter out accessories that won't be visible based on shot type
  if (descriptor.inherentAccessories && descriptor.inherentAccessories.length > 0) {
    // Belt is only visible if bottom garments are visible (or partially visible)
    const beltVisible = isBottomVisible(shotType) || mayPartiallyShowBottom(shotType)
    const visibleAccessories = descriptor.inherentAccessories.filter(acc => {
      if (acc === 'belt') return beltVisible
      // Other accessories (cufflinks, etc.) are always included if present
      return true
    })
    if (visibleAccessories.length > 0) {
      wardrobe.inherent_accessories = visibleAccessories
    }
  }

  const colorPalette = buildColorPalette(clothingColors && hasValue(clothingColors) ? clothingColors.value : undefined, detailKey, descriptor, shotType)
  if (colorPalette) {
    wardrobe.color_palette = colorPalette
  }

  return {
    styleKey,
    detailKey,
    descriptor,
    wardrobe
  }
}

/**
 * Get wardrobe descriptor for a given style and detail
 * Returns the full descriptor or a fallback if not found
 */
export function getWardrobeDescriptor(
  style: KnownClothingStyle | string,
  detail?: string
): WardrobeDetailConfig {
  const styleKey = normalizeStyle(style)
  const detailKey = normalizeDetail(detail, styleKey)
  return resolveWardrobeDescriptor(styleKey, detailKey)
}

/**
 * Get clothing color exclusions for a given style and detail
 * Used by UI to filter color selector options
 */
export function getWardrobeExclusions(
  style: KnownClothingStyle | string,
  detail?: string
): ClothingColorKey[] {
  const styleKey = normalizeStyle(style)
  const detailKey = normalizeDetail(detail, styleKey)
  const descriptor = WARDROBE_DETAILS[styleKey]?.[detailKey]
  return descriptor?.excludeClothingColors || []
}

const CLOTHING_TEMPLATE_REFERENCE_DESCRIPTION =
  'CLOTHING TEMPLATE - Compositional guide showing garment types, colors, layering, and logo placement. Use this for WHAT to dress the person in and WHERE the logo goes, but generate your own high-quality photorealistic fabric textures - do NOT copy the low-resolution fabric from this reference. NOTE: If the logo has a bright green background, that is a chroma key for visibility only - do NOT include the green background in the output, only the logo elements on the fabric.'

const CLOTHING_OVERLAY_CONTRIBUTION_MUST_FOLLOW = [
  'Use the clothing overlay as the PRIMARY reference for garment composition, colors, logo placement, and overall styling.',
  'FABRIC QUALITY: The overlay is a low-resolution compositional guide. Do NOT replicate the fabric texture from the overlay pixel-for-pixel. Instead, generate photorealistic, high-quality fabric textures (cotton weave, wool texture, silk sheen, etc.) appropriate to each garment type. The fabric should look continuous, natural, and physically plausible with proper folds, draping, and light interaction.',
  'Replicate the EXACT garment types, colors, patterns, logos, and layering shown in the overlay - but render all fabrics at full quality with continuous, seamless textures.',
  'Logo handling: The logo in the overlay may have a bright GREEN (chroma key) background for visibility. Do NOT include the green background - only reproduce the logo elements themselves on the fabric.',
  'Logo handling: Preserve the base-layer logo exactly as shown. If an outer layer naturally covers part of it, that is expected. Do NOT relocate or "save" the logo.',
  'Do NOT modify, reinterpret, or add clothing elements. For clothing/branding/logo info, ignore all other references and use the overlay only.',
]

const CLOTHING_OVERLAY_CONTRIBUTION_FREEDOM = [
  'The clothing overlay shows ONLY the core garments in a flat-lay arrangement - it does NOT show the person.',
  'All facial features and personal accessories (glasses, earrings, watches, jewelry) come from the SELFIE references, NOT from the clothing overlay.',
  'If the selfies show glasses, include those same glasses.',
]

export function getClothingTemplateReferenceDescription(): string {
  return CLOTHING_TEMPLATE_REFERENCE_DESCRIPTION
}

export function getClothingOverlayContributionMustFollowRules(): string[] {
  return [...CLOTHING_OVERLAY_CONTRIBUTION_MUST_FOLLOW]
}

export function getClothingOverlayContributionFreedomRules(): string[] {
  return [...CLOTHING_OVERLAY_CONTRIBUTION_FREEDOM]
}

interface ClothingTemplate {
  description: string
  layers: string[]
  logoLayer: string
  logoPosition: string
  logoStyle: string
  isLayered: boolean
}

type ClothingOverlayColorOverrides = {
  baseLayer?: string | ColorValue
  topLayer?: string | ColorValue
  bottom?: string | ColorValue
  shoes?: string | ColorValue
}

const CLOTHING_OVERLAY_TEMPLATES: Record<string, ClothingTemplate> = {
  'business-casual': {
    description: 'Business casual with jacket over deluxe t-shirt',
    layers: [
      'Base layer: Deluxe t-shirt (substantial and refined, like Mercerized cotton, Pima cotton, or modal blends, with a tight crew neck)',
      'Outer layer: Blazer or suit jacket, worn open',
    ],
    logoLayer: 'Base layer (deluxe t-shirt)',
    logoPosition: 'Center chest, slightly below neckline',
    logoStyle: 'printed or embroidered',
    isLayered: true,
  },
  'business-formal': {
    description: 'Business formal with dress shirt visible',
    layers: ['Base layer: Formal dress shirt', 'Outer layer: Suit jacket, partially open'],
    logoLayer: 'Base layer (dress shirt)',
    logoPosition: 'Upper right chest, where pocket would be',
    logoStyle: 'embroidered crest',
    isLayered: true,
  },
  'business-pantsuit': {
    description: 'Pantsuit with blouse visible',
    layers: ['Base layer: Blouse or dress shirt', 'Outer layer: Suit jacket, partially open'],
    logoLayer: 'Base layer (blouse)',
    logoPosition: 'Upper right chest, where pocket would be',
    logoStyle: 'embroidered crest',
    isLayered: true,
  },
  'business-blouse': {
    description: 'Blouse with blazer',
    layers: ['Base layer: Blouse', 'Outer layer: Blazer, partially open'],
    logoLayer: 'Base layer (blouse)',
    logoPosition: 'Upper right chest',
    logoStyle: 'embroidered',
    isLayered: true,
  },
  'startup-button-down': {
    description: 'Casual button-down over t-shirt',
    layers: ['Base layer: T-shirt', 'Outer layer: Button-down shirt, worn open'],
    logoLayer: 'Base layer (t-shirt)',
    logoPosition: 'Center chest',
    logoStyle: 'screen printed',
    isLayered: true,
  },
  'startup-cardigan': {
    description: 'Cardigan over t-shirt or dress',
    layers: ['Base layer: T-shirt or dress', 'Outer layer: Cardigan, worn open'],
    logoLayer: 'Base layer',
    logoPosition: 'Center chest',
    logoStyle: 'printed',
    isLayered: true,
  },
  'startup-t-shirt': {
    description: 'Casual t-shirt',
    layers: ['T-shirt'],
    logoLayer: 'T-shirt',
    logoPosition: 'Center chest, slightly below neckline',
    logoStyle: 'screen printed',
    isLayered: false,
  },
  'startup-hoodie': {
    description: 'Casual hoodie',
    layers: ['Hoodie'],
    logoLayer: 'Hoodie chest',
    logoPosition: 'Center chest, slightly below neckline, above hoodie pocket',
    logoStyle: 'screen printed or embroidered',
    isLayered: false,
  },
  'startup-polo': {
    description: 'Polo shirt',
    layers: ['Polo shirt'],
    logoLayer: 'Polo shirt',
    logoPosition: 'Left chest, where traditional polo logo would be',
    logoStyle: 'embroidered, small to medium sized',
    isLayered: false,
  },
  'startup-blouse': {
    description: 'Blouse',
    layers: ['Blouse'],
    logoLayer: 'Blouse',
    logoPosition: 'Center chest or upper left chest',
    logoStyle: 'embroidered',
    isLayered: false,
  },
  'startup-dress': {
    description: 'Dress',
    layers: ['Dress'],
    logoLayer: 'Dress bodice',
    logoPosition: 'Center chest area of bodice',
    logoStyle: 'embroidered or printed',
    isLayered: false,
  },
  'startup-jumpsuit': {
    description: 'Jumpsuit',
    layers: ['Jumpsuit'],
    logoLayer: 'Jumpsuit bodice',
    logoPosition: 'Center chest',
    logoStyle: 'embroidered or printed',
    isLayered: false,
  },
  'business-dress': {
    description: 'Professional dress',
    layers: ['Dress'],
    logoLayer: 'Dress bodice',
    logoPosition: 'Upper left chest as subtle embroidered crest',
    logoStyle: 'tasteful embroidered mark',
    isLayered: false,
  },
  'black-tie-tuxedo': {
    description: 'Tuxedo with dress shirt visible',
    layers: ['Base layer: Dress shirt', 'Outer layer: Tuxedo jacket, partially open'],
    logoLayer: 'Base layer (dress shirt)',
    logoPosition: 'Upper right chest, where pocket would be',
    logoStyle: 'embroidered crest',
    isLayered: true,
  },
  'black-tie-suit': {
    description: 'Formal suit with dress shirt visible',
    layers: ['Base layer: Dress shirt', 'Outer layer: Suit jacket, partially open'],
    logoLayer: 'Base layer (dress shirt)',
    logoPosition: 'Upper right chest, where pocket would be',
    logoStyle: 'embroidered crest',
    isLayered: true,
  },
  'black-tie-dress': {
    description: 'Elegant evening dress',
    layers: ['Gown/dress'],
    logoLayer: 'Gown bodice',
    logoPosition: 'Upper left chest as elegant embroidered crest',
    logoStyle: 'tasteful applique',
    isLayered: false,
  },
  'black-tie-gown': {
    description: 'Formal evening gown',
    layers: ['Gown'],
    logoLayer: 'Gown bodice',
    logoPosition: 'Upper left chest as elegant embroidered crest',
    logoStyle: 'tasteful applique',
    isLayered: false,
  },
}

function getClothingOverlayTemplate(styleKey: string): ClothingTemplate {
  return CLOTHING_OVERLAY_TEMPLATES[styleKey] || CLOTHING_OVERLAY_TEMPLATES['startup-t-shirt']
}

export function buildClothingOverlayGenerationPrompt(params: {
  clothing: ClothingValue
  shotType?: string
  clothingColors?: ClothingOverlayColorOverrides
}): string {
  const shotType = params.shotType || 'medium-shot'
  const wardrobeResult = generateWardrobePrompt({
    clothing: params.clothing,
    clothingColors: params.clothingColors
      ? { mode: 'predefined', value: params.clothingColors }
      : undefined,
    shotType: shotType as ShotTypeValue,
  })

  const { styleKey, detailKey, descriptor, wardrobe } = wardrobeResult
  const template = getClothingOverlayTemplate(`${styleKey}-${detailKey}`)

  const showPants =
    shotType === 'full-body' || shotType === 'three-quarter' || shotType === 'full-length'
  const showShoes = shotType === 'full-body' || shotType === 'full-length'

  const layerDescriptions: string[] = []
  const isSingleLayer = !descriptor.outerLayer

  const topLayerColorDisplay = params.clothingColors?.topLayer
    ? getColorDisplay(params.clothingColors.topLayer)
    : undefined
  const baseLayerColorDisplay = params.clothingColors?.baseLayer
    ? getColorDisplay(params.clothingColors.baseLayer)
    : undefined
  const bottomColorDisplay = params.clothingColors?.bottom
    ? getColorDisplay(params.clothingColors.bottom)
    : undefined
  const shoesColorDisplay = params.clothingColors?.shoes
    ? getColorDisplay(params.clothingColors.shoes)
    : undefined

  if (wardrobe.top_layer) {
    const layerName = isSingleLayer ? 'Main garment' : 'Outer layer'
    const colorSuffix = topLayerColorDisplay ? ` — COLOR: ${topLayerColorDisplay}` : ''
    layerDescriptions.push(`${layerName}: ${wardrobe.top_layer}${colorSuffix}`)
  }

  if (wardrobe.base_layer && !isSingleLayer) {
    layerDescriptions.push(`Base layer: ${wardrobe.base_layer} — COLOR: ${baseLayerColorDisplay}`)
  }

  if (showPants) {
    const colorSuffix = bottomColorDisplay
      ? ` in ${bottomColorDisplay} color`
      : ' in coordinating neutral color'
    layerDescriptions.push(
      `\nPants: Professional ${styleKey === 'business' ? 'dress pants or trousers' : 'casual pants or chinos'}${colorSuffix}`
    )
  }

  const inherentAccessories = wardrobe.inherent_accessories as string[] | undefined
  const showBelt = showPants && inherentAccessories?.includes('belt')
  if (showBelt) {
    layerDescriptions.push(
      '\nBelt: Professional leather belt in a coordinating color (black or brown to match shoes/pants)'
    )
  }

  if (showShoes) {
    const shoesType = styleKey === 'business' ? 'Professional dress shoes' : 'Clean casual shoes'
    const shoesDescription = shoesColorDisplay
      ? `${shoesType} in ${shoesColorDisplay} color`
      : shoesType
    layerDescriptions.push(`\nShoes: ${shoesDescription}`)
  }

  const garmentCount =
    (wardrobe.top_layer ? 1 : 0) +
    (wardrobe.base_layer && !isSingleLayer ? 1 : 0) +
    (showPants ? 1 : 0) +
    (showBelt ? 1 : 0) +
    (showShoes ? 1 : 0)

  const layoutParts = [`STANDARDIZED LAYOUT REQUIREMENTS:
- Arrange items in a GRID layout on a clean white background with ALL items FULLY SEPARATED
- CRITICAL: NO overlapping - each garment must be completely visible with clear space between items
- CRITICAL: Show EXACTLY ${garmentCount} item(s) total - no more, no less`]

  if (isSingleLayer) {
    layoutParts.push(
      `- Main garment (${wardrobe.top_layer}) laid perfectly flat, facing forward, symmetrical, fully spread out, 100% visible`
    )
  } else {
    layoutParts.push(
      `- Base layer (${wardrobe.base_layer}) in its own space, 100% visible with no obstructions`
    )
    layoutParts.push(
      `- Outer layer (${wardrobe.top_layer}) in its own separate space, NOT touching or overlapping the base layer`
    )
  }

  if (showPants) {
    layoutParts.push('- Pants in their own separate space below, NOT touching upper garments')
  }
  if (showBelt) {
    layoutParts.push(
      '- Belt positioned near/on the pants waistband area, showing buckle and leather strap'
    )
  }
  if (showShoes) {
    layoutParts.push('- Shoes in their own separate space at the bottom, NOT touching other items')
  }

  layoutParts.push('- Minimum 5cm spacing between ALL items - no parts of any garment should touch')
  layoutParts.push(
    '- All items laid perfectly flat, facing forward, symmetrical, fully spread out'
  )
  layoutParts.push('- Professional product catalog photography style showing each item individually')
  layoutParts.push('- Soft, even studio lighting with minimal shadows')
  layoutParts.push('- Each garment should be photographed as if it\'s a standalone product listing')

  const layoutInstructions = layoutParts.join('\n')

  const colorRules: string[] = []
  if (isSingleLayer) {
    if (topLayerColorDisplay) {
      colorRules.push(`- The main garment MUST be ${topLayerColorDisplay}. Do NOT use any other color.`)
    }
  } else {
    if (topLayerColorDisplay) {
      colorRules.push(
        `- The outer layer (jacket/blazer) MUST be ${topLayerColorDisplay}. Do NOT use any other color.`
      )
    }
    if (baseLayerColorDisplay) {
      colorRules.push(
        `- The base layer (t-shirt/shirt underneath) MUST be ${baseLayerColorDisplay}. Do NOT use any other color.`
      )
    }
  }
  if (showPants && bottomColorDisplay) {
    colorRules.push(`- The pants MUST be ${bottomColorDisplay}. Do NOT use any other color.`)
  }
  if (showShoes && shoesColorDisplay) {
    colorRules.push(`- The shoes MUST be ${shoesColorDisplay}. Do NOT use any other color.`)
  }

  const colorSection = colorRules.length > 0
    ? `MANDATORY COLOR RULES (NON-NEGOTIABLE):
${colorRules.join('\n')}
- Each garment color is specified above and MUST be followed exactly. Do NOT substitute, approximate, or reinterpret any color.
`
    : ''

  return `
CREATE A PROFESSIONAL CLOTHING TEMPLATE WITH LOGO:

You are creating a standardized flat-lay photograph showing clothing items with a company logo.

CLOTHING ITEMS TO SHOW:
${layerDescriptions.map((layer, i) => `${i + 1}. ${layer}`).join('\n')}

${layoutInstructions}

${colorSection}LOGO PLACEMENT - CRITICAL REQUIREMENTS:
TARGET GARMENT: ${template.logoLayer}
POSITION: ${template.logoPosition}
STYLE: ${template.logoStyle}

LOGO REPRODUCTION RULES (MUST FOLLOW EXACTLY):
1. COPY the logo from the reference image with PERFECT ACCURACY - every letter, icon, and element must be included
2. CRITICAL: If the logo has a bright GREEN background, that is a CHROMA KEY for visibility only - do NOT include the green background. Only reproduce the logo elements (text, icons, graphics) on the fabric.
3. CRITICAL: Include EVERY letter and character visible in the logo - DO NOT skip or omit any text
4. If the logo contains text, reproduce each letter individually and completely - check that all letters are present
5. If the logo contains icons or graphics, reproduce every line, shape, and detail exactly
6. DO NOT modify, stylize, or reinterpret the logo design in any way
7. DO NOT alter logo colors - use the EXACT colors from the reference for each element (ignore the green chroma background)
8. DO NOT change logo proportions or aspect ratio
9. The logo should appear ${template.logoStyle} on the fabric with all elements intact
10. Size: The logo should be proportional (approx 8-12cm width on the garment)
11. ONLY place the logo on the base layer garment - NEVER on outer layers
12. The logo must be clearly visible and sharp with ALL text/graphics legible
13. Before finalizing, verify that EVERY letter and element from the reference logo is present in your output

CRITICAL QUALITY STANDARDS:
- Photorealistic fabric textures (cotton weave, wool texture, etc.)
- Sharp focus on all garments, especially the logo area
- Consistent, neutral white background (RGB 255,255,255)
- No shadows or gradients on the background
- Professional lighting that shows fabric detail without harsh shadows
- The logo must be the EXACT same as the reference image

FORBIDDEN:
- DO NOT add creative styling or artistic interpretation
- DO NOT modify the logo design in any way
- DO NOT add text labels or annotations
- DO NOT show a person wearing the clothes
- DO NOT use colored or patterned backgrounds
- DO NOT overlap or layer garments on top of each other
- DO NOT arrange items in a way that hides any part of any garment
- DO NOT create an artistic composition - this is a technical product reference
- DO NOT include the green chroma key background from the logo reference - only the logo elements

OUTPUT SPECIFICATIONS:
- PNG image with white background
- All items clearly visible and properly colored
- Logo EXACTLY matching the reference image with ALL letters and elements present, correctly positioned on base layer

LOGO REFERENCE: Use the attached logo image as your ONLY source for logo design, colors, and proportions. Copy it EXACTLY with every single letter, character, icon, and graphic element included.

FINAL VERIFICATION BEFORE OUTPUT:
1. Compare your generated logo against the reference image
2. Count the letters/characters in the reference and verify your output has the same count
3. Check that every icon, line, and graphic element from the reference is present
4. Confirm all colors match the reference exactly
5. Only output the image once you've verified 100% accuracy
`.trim()
}

export function getClothingColorHex(value?: string | ColorValue): string | undefined {
  return getColorHex(value)
}
