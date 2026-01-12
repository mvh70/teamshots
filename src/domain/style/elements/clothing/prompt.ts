import type {
  ClothingColorSettings,
  ClothingColorValue,
  ShotTypeValue
} from '@/types/photo-style'
import type { ClothingValue } from './types'
import type { KnownClothingStyle, WardrobeDetailConfig } from './config'
import type { ClothingColorKey } from '@/domain/style/elements/clothing-colors/types'
import { getColorDisplay } from '@/domain/style/elements/clothing-colors/types'
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
      notes: 'Pressed fabrics and polished appearance suitable for boardroom settings.'
    },
    casual: {
      details: 'High-end business-casual ensemble with modern styling. Do NOT add a tie or other accessories by default, only add them when specifically specified in the accessories section.',
      baseLayer: 'A deluxe T-Shirt. Substantial and refined, like Mercerized cotton, Pima cotton, or modal blends, with a tight crew neck',
      outerLayer: ' A single-breasted jacket with a subtle herringbone weave, adding a classic and refined touch to the overall look.',
      notes: 'Maintain relaxed but refined posture.'
    },
    blouse: {
      details: 'Polished blouse paired with tailored trousers or skirt',
      baseLayer: 'silk or satin blouse',
      outerLayer: 'structured blazer framing the neckline',
      notes: 'Keep jewelry minimal and ensure blouse remains smooth.'
    },
    dress: {
      details: 'Structured sheath dress with a corporate-ready silhouette',
      baseLayer: 'form-fitting dress bodice',
      notes: 'Optional lightweight blazer may be draped over shoulders.',
      excludeClothingColors: ['baseLayer']
    },
    pantsuit: {
      details: 'Contemporary tailored pantsuit with defined waist',
      baseLayer: 'sleek camisole or blouse beneath the suit jacket',
      outerLayer: 'matching blazer worn slightly open to reveal the base layer',
      notes: 'Maintain sharp creases and refined tailoring for an authoritative look.'
    }
  },
  startup: {
    't-shirt': {
      details: 'Modern startup look centered around a fitted crewneck tee',
      baseLayer: 'well-fitted crewneck t-shirt',
      notes: 'Keep silhouette clean and wrinkle-free; no outer layer required.',
      excludeClothingColors: ['baseLayer']
    },
    hoodie: {
      details: 'Casual startup hoodie outfit with relaxed confidence',
      baseLayer: 'premium hoodie',
      notes: 'Hood down, sleeves neat; keep presentation polished despite casual tone.',
      excludeClothingColors: ['baseLayer']
    },
    polo: {
      details: 'Smart casual polo ensemble',
      baseLayer: 'tailored short-sleeve polo with structured collar',
      notes: 'Buttons neat, collar crisp to balance relaxed and professional cues.',
      excludeClothingColors: ['baseLayer']
    },
    'button-down': {
      details: 'Casual button-down shirt worn open over a t-shirt',
      baseLayer: 'fitted t-shirt',
      outerLayer: 'lightweight button-down shirt worn open to frame the base layer',
      notes: 'Button-down sleeves can be crisp or subtly rolled; keep base layer visible.',
      excludeClothingColors: []
    },
    blouse: {
      details: 'Relaxed blouse with tailored trousers or midi skirt',
      baseLayer: 'flowy blouse',
      notes: 'Keep fabric smooth and opt for rolled sleeves to maintain an approachable tone.',
      excludeClothingColors: ['baseLayer']
    },
    cardigan: {
      details: 'Layered cardigan over a clean base garment',
      baseLayer: 'minimal knit dress or tee beneath the cardigan',
      outerLayer: 'open-front cardigan draped naturally',
      notes: 'Keep cardigan edges neat and balanced.',
      excludeClothingColors: []
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
      excludeClothingColors: ['baseLayer']
    }
  },
  'black-tie': {
    tuxedo: {
      details: 'Classic black-tie tuxedo ensemble',
      baseLayer: 'pleated dress shirt with bow tie and subtle studs',
      outerLayer: 'satin-lapel tuxedo jacket fastened at the top button',
      notes: 'Include pocket square or lapel pin if colors are provided.'
    },
    suit: {
      details: 'Polished evening suit presentation',
      baseLayer: 'dress shirt with coordinating tie or bow tie',
      outerLayer: 'tailored suit jacket with structured shoulders',
      notes: 'Maintain sleek, pressed silhouette.'
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
      excludeClothingColors: ['baseLayer']
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
    const colorValue = getColorDisplay(colors.bottom)
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colorValue} color`)
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
