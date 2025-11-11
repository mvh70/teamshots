import type {
  ClothingColorSettings,
  ClothingSettings,
  ShotTypeValue
} from '@/types/photo-style'

type KnownStyle = 'business' | 'startup' | 'black-tie'

interface WardrobeDetailConfig {
  details: string
  baseLayer: string
  outerLayer?: string
  notes?: string
}

const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down', 'dress', 'gown', 'jumpsuit'])

const WARDROBE_DETAILS: Record<KnownStyle, Record<string, WardrobeDetailConfig>> = {
  business: {
    formal: {
      details: 'Tailored business suit ensemble with clean lines',
      baseLayer: 'crisp dress shirt with subtle sheen and coordinating tie',
      outerLayer: 'structured suit jacket fastened with a single button',
      notes: 'Pressed fabrics and polished appearance suitable for boardroom settings.'
    },
    casual: {
      details: 'Smart business-casual outfit with relaxed tailoring',
      baseLayer: 'premium knit top or blouse ideal for tasteful logo placement',
      outerLayer: 'unstructured blazer worn open for an approachable look',
      notes: 'No tie; maintain relaxed but refined posture.'
    },
    blouse: {
      details: 'Polished blouse paired with tailored trousers or skirt',
      baseLayer: 'silk or satin blouse ready for subtle left-chest embroidery',
      outerLayer: 'structured blazer framing the neckline and logo',
      notes: 'Keep jewelry minimal and ensure blouse remains smooth around the logo.'
    },
    dress: {
      details: 'Structured sheath dress with a corporate-ready silhouette',
      baseLayer: 'form-fitting dress bodice suited for embroidered crest placement',
      notes: 'Optional lightweight blazer may be draped over shoulders without covering the logo.'
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
      baseLayer: 'well-fitted crewneck t-shirt ready for central logo placement',
      notes: 'Keep silhouette clean and wrinkle-free; no outer layer required.'
    },
    hoodie: {
      details: 'Casual startup hoodie outfit with relaxed confidence',
      baseLayer: 'premium hoodie layered over a minimal base tee',
      notes: 'Hood down, sleeves neat; keep presentation polished despite casual tone.'
    },
    polo: {
      details: 'Smart casual polo ensemble',
      baseLayer: 'tailored short-sleeve polo with structured collar',
      notes: 'Buttons neat, collar crisp to balance relaxed and professional cues.'
    },
    'button-down': {
      details: 'Crisp startup button-down outfit',
      baseLayer: 'lightweight button-down shirt neatly pressed',
      outerLayer: 'optional lightweight jacket or overshirt left open',
      notes: 'Sleeves either crisp or subtly rolled, matching brand tone.'
    },
    blouse: {
      details: 'Relaxed blouse with tailored trousers or midi skirt',
      baseLayer: 'flowy blouse designed for centered or left-chest branding',
      notes: 'Keep fabric smooth and opt for rolled sleeves to maintain an approachable tone.'
    },
    cardigan: {
      details: 'Layered cardigan over a clean base garment',
      baseLayer: 'minimal knit dress or tee beneath the cardigan',
      outerLayer: 'open-front cardigan draped naturally to frame the logo',
      notes: 'Ensure cardigan edges do not obscure the logo placement.'
    },
    dress: {
      details: 'Casual startup dress with a streamlined silhouette',
      baseLayer: 'knee-length knit dress ideal for centered logo application',
      notes: 'Avoid busy patterns so the branding stays legible.'
    },
    jumpsuit: {
      details: 'Modern startup jumpsuit with tailored bodice',
      baseLayer: 'structured jumpsuit torso suited for subtle embroidery',
      notes: 'Define the waist with a belt and keep accessories minimal.'
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
      notes: 'Focus on graceful draping and refined fabrication.'
    },
    gown: {
      details: 'Floor-length evening gown with dramatic draping',
      baseLayer: 'sleek gown bodice that supports delicate embroidery',
      notes: 'Pair with refined accessories; keep fabric smooth around the logo area.'
    },
    jumpsuit: {
      details: 'Sophisticated formal jumpsuit',
      baseLayer: 'structured jumpsuit bodice tailored for elegant branding',
      notes: 'Accentuate with statement belt or jewelry while maintaining a polished silhouette.'
    }
  }
}

const FALLBACK_DETAIL_BY_STYLE: Record<KnownStyle, string> = {
  business: 'formal',
  startup: 't-shirt',
  'black-tie': 'suit'
}

export interface WardrobePromptInput {
  clothing?: ClothingSettings | null
  clothingColors?: ClothingColorSettings | null
  shotType?: ShotTypeValue | null
}

export interface WardrobePromptResult {
  styleKey: KnownStyle
  detailKey: string
  descriptor: WardrobeDetailConfig
  wardrobe: Record<string, unknown>
}

const isFullBodyVisible = (shotType?: ShotTypeValue | null) =>
  shotType === 'full-body' || shotType === 'full-length' || shotType === 'wide-shot'

const isBottomVisible = (shotType?: ShotTypeValue | null) =>
  isFullBodyVisible(shotType) || shotType === 'midchest' || shotType === 'three-quarter'

const normalizeStyle = (style?: string | null): KnownStyle => {
  const normalized = style?.toLowerCase?.() ?? ''
  if (normalized === 'business' || normalized === 'startup' || normalized === 'black-tie') {
    return normalized
  }
  return 'startup'
}

const normalizeDetail = (detail: string | undefined, styleKey: KnownStyle): string => {
  if (detail && detail.trim().length > 0) {
    return detail.toLowerCase()
  }
  return FALLBACK_DETAIL_BY_STYLE[styleKey]
}

const resolveWardrobeDescriptor = (
  styleKey: KnownStyle,
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

export type { KnownStyle, WardrobeDetailConfig }

