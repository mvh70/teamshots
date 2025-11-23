import type {
  ClothingColorSettings,
  ClothingSettings,
  ShotTypeValue
} from '@/types/photo-style'
import { 
  KnownClothingStyle, 
  WardrobeDetailConfig, 
  NO_TOP_COVER_DETAILS, 
  WARDROBE_DETAILS, 
  FALLBACK_DETAIL_BY_STYLE 
} from './config'

export interface WardrobePromptInput {
  clothing?: ClothingSettings | null
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
  colors: ClothingColorSettings['colors'] | undefined,
  detailKey: string,
  descriptor: WardrobeDetailConfig,
  shotType?: ShotTypeValue | null
): string[] | undefined => {
  if (!colors) return undefined
  const palette: string[] = []

  // Always add base layer color if provided
  if (colors.topBase) {
    palette.push(`base layer (e.g., shirt under hoodie, dress shirt under blazer): ${colors.topBase} color`)
  }

  // Handle topCover color based on garment type
  if (colors.topCover) {
    if (NO_TOP_COVER_DETAILS.has(detailKey)) {
      // For items like hoodie, t-shirt, dress - topCover is the main garment color
      palette.push(`${detailKey} (the main visible garment): ${colors.topCover} color`)
    } else if (descriptor.outerLayer) {
      // For items with separate outer layer (jacket, blazer, etc.)
      palette.push(`outer layer (e.g., suit jacket, blazer, cardigan): ${colors.topCover} color`)
    }
  }

  if (colors.bottom && isBottomVisible(shotType)) {
    palette.push(`bottom garment (trousers, skirt, dress pants): ${colors.bottom} color`)
  }

  if (colors.shoes && isFullBodyVisible(shotType)) {
    palette.push(`shoes (dress shoes, loafers, heels): ${colors.shoes} color`)
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
    details: descriptor.details,
    base_layer: descriptor.baseLayer
  }

  if (descriptor.outerLayer) {
    wardrobe.outer_layer = descriptor.outerLayer
  }
  if (descriptor.notes) {
    wardrobe.notes = descriptor.notes
  }
  if (clothing?.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
    wardrobe.accessories = clothing.accessories
  }

  const colorPalette = buildColorPalette(clothingColors?.colors, detailKey, descriptor, shotType)
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
