import { PhotoStyleSettings, BackgroundSettings } from '@/types/photo-style'
import type { StylePackage } from '../index'
import { generateBackgroundPrompt } from '../../backgrounds'

const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down'])

// Default settings
const DEFAULTS = {
  background: { type: 'neutral' as const, color: '#f2f2f2' },
  branding: { type: 'exclude' as const },
  clothing: { style: 'startup' as const, details: 't-shirt' },
  clothingColors: {
    type: 'predefined' as const,
    colors: {
      topBase: '#ffffff',
      topCover: '#4a5568',
      shoes: 'white',
      bottom: '#ea1010'
    }
  },
  shotType: { type: 'headshot' as const },
  expression: { type: 'happy' as const }
}

/**
 * Helper to get value or default, handling 'user-choice' as undefined
 * Used only in promptBuilder to resolve settings before building prompt
 */
function getValueOrDefault<T>(value: T | undefined | { type?: string }, defaultValue: T): T {
  if (!value) return defaultValue
  
  return value as T
}

/**
 * Build the prompt step by step based on settings
 * Assumes all values are already resolved (no user-choice, defaults applied)
 */
function buildPrompt(settings: PhotoStyleSettings): string {
  // Initialize prompt structure
  const sceneEnv: Record<string, unknown> = {}
  const scene: Record<string, unknown> = { environment: sceneEnv }
  const subject: Record<string, unknown> = {
    type: 'subject from the attached image, maintaining the facial structure, identity, and key features of the input image.',
    pose: {}
  }
  const framing_composition: Record<string, unknown> = {}
  const camera: Record<string, unknown> = {}
  const lighting: Record<string, unknown> = {}
  const rendering_intent: Record<string, unknown> = {}

  // Precompute shot type for downstream logic
  const isFullBody = settings.shotType?.type === 'full-body'

  // Step 1: Background
  const background = settings.background
  if (background && background.type) {
    const bgPrompt = generateBackgroundPrompt(background)
    Object.assign(sceneEnv, bgPrompt)
  }

  // Step 2: Branding
  const branding = settings.branding
  const brandingType = branding?.type
  const brandingPosition = branding?.position

  if (brandingType === 'include') {
    let rules: string
    if (brandingPosition === 'background') {
      rules = 'Place the provided brand logo once as a framed element on a background wall only, aligned with the wall perspective. Do not place on the subject, floors, windows, or floating in space. Keep original colors and aspect ratio.'
    } else if (brandingPosition === 'elements') {
      rules = 'Place the provided brand logo once on a plausible scene element only, such as: a coffee mug label, a laptop sticker, a notebook cover, a standing banner flag, a signboard, or a door plaque. The element must be grounded in the scene (on a desk/floor/wall) and the logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.'
    } else {
      // Default: clothing
      rules = 'Place the provided brand logo exactly once on the center chest area of the base garment (e.g., t‑shirt/hoodie/shirt). Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin. Do not create patterns or duplicates. Keep original aspect ratio and colors; no stylization or warping. The logo size should be modest and proportional to the garment.'
    }
    subject.branding_rules = rules
  } else if (brandingType === 'exclude') {
    sceneEnv.branding = 'no brand marks'
  }

  // Step 3: Clothing
  const clothing = settings.clothing
  if (clothing && clothing.style) {
    const clothingStyle = clothing.style
    const clothingDetails = clothing.details || DEFAULTS.clothing.details
    const clothingDetailsLower = clothingDetails.toLowerCase()

    const wardrobe: Record<string, unknown> = {
      style: clothingStyle,
      details: clothingDetails
    }

    // Add accessories if provided
    if (clothing.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
      wardrobe.accessories = clothing.accessories
    }

    // Step 3a: Clothing Colors
    const clothingColors = settings.clothingColors
    if (clothingColors && clothingColors.type === 'predefined' && clothingColors.colors) {
      const colors = clothingColors.colors
      const colorParts: string[] = []

      // Top cover color (only if applicable)
      const includeTopCover = Boolean(colors.topCover) && !NO_TOP_COVER_DETAILS.has(clothingDetailsLower)
      if (includeTopCover && colors.topCover) {
        colorParts.push(`top cover (jacket, blazer, etc.): ${colors.topCover} color`)
      }

      // Top base color
      if (colors.topBase) {
        colorParts.push(`base layer: ${colors.topBase} color`)
        
        // Add logo instruction if branding is on clothing
        if (brandingType === 'include' && (!brandingPosition || brandingPosition === 'clothing')) {
          colorParts.push('the base garment (t-shirt, shirt under jacket, hoodie, polo, button down) features a brand logo from the attached image, positioned prominently on the chest area')
        }
      }

      // Bottom color
      if (colors.bottom) {
        colorParts.push(`The trousers are in ${colors.bottom} color`)
      }

      // Shoes color (only relevant for full body shots - not visible in headshot/midchest)
      if (isFullBody && colors.shoes) {
        colorParts.push(`The shoes are in ${colors.shoes} color`)
      }

      if (colorParts.length > 0) {
        wardrobe.color_palette = colorParts
      }
    }

    subject.wardrobe = wardrobe

    // Pose description handled in shot type section
  }

  // Step 4: Expression
  const expression = settings.expression
  if (expression && expression.type) {
    const expressionMap: Record<string, string> = {
      professional: 'professional, approachable expression with a subtle smile',
      friendly: 'friendly warm smile',
      serious: 'serious neutral expression',
      confident: 'confident slight smile',
      happy: 'happy smile',
      sad: 'subtle sad expression',
      neutral: 'neutral expression',
      thoughtful: 'thoughtful look'
    }
    const expressionDesc = expressionMap[expression.type] || 'neutral expression'
    const poseObj = subject.pose as Record<string, unknown>
    subject.pose = {
      ...poseObj,
      expression: expressionDesc
    }
  }

  // Step 5: Shot Type
  const shotType = settings.shotType
  if (shotType && shotType.type) {
    if (shotType.type === 'headshot') {
      framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
    } else if (shotType.type === 'midchest') {
      framing_composition.shot_type = 'mid-chest portrait, showing from chest up with positive space around the subject'
    } else if (shotType.type === 'full-body') {
      framing_composition.shot_type = 'full body portrait, showing the complete subject from head to toe; include the entire body with feet fully visible, no cropping at ankles or knees; keep a bit of floor visible beneath the shoes'
      camera.lens = { focal_length_mm: 35, type: 'prime', character: 'neutral rendering, low distortion' }
      framing_composition.composition_rules = 'Frame the subject head-to-toe within a vertical canvas; maintain comfortable headroom and footroom; do not crop any part of the body; step back to capture the entire person if needed.'
    } else {
      // Default fallback
      framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
    }

    // Pose description based on branding on clothing and clothing style
    if (brandingType === 'include' && (!brandingPosition || brandingPosition === 'clothing')) {
      const clothingStyleLower = (settings.clothing?.style || '').toLowerCase()
      const poseObj = subject.pose as Record<string, unknown>
      if (clothingStyleLower.includes('business') || clothingStyleLower.includes('black tie')) {
        subject.pose = {
          ...poseObj,
          description: 'elegantly opening the jacket to reveal the logo on the base garment beneath. The jacket should not open fully, it is stll buttoned closed on the bottom, to tastefully display the logo'
        }
      } else if (clothingStyleLower.includes('startup')) {
        subject.pose = {
          ...poseObj,
          description: 'both hands gently pointing towards the logo on the base garment (t-shirt/hoodie/polo/button down) to draw attention in a natural, professional manner'
        }
      }
    }
  } else {
    // Default when missing
    framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
  }

  // Step 6: Framing defaults
  framing_composition.orientation = 'vertical'
  framing_composition.background_separation = 'soft'

  // Step 7: Camera settings
  camera.sensor = 'full-frame mirrorless'
  if (!camera.lens) {
    camera.lens = { focal_length_mm: 85, type: 'prime', character: 'neutral rendering, low distortion' }
  }
  camera.settings = { 
    aperture: 'f/2.8', 
    shutter_speed: '1/200', 
    iso: 200, 
    white_balance: 'auto', 
    focus: 'eye-AF' 
  }

  // Step 8: Lighting
  lighting.quality = 'soft, natural'

  // Step 9: Rendering intent
  rendering_intent.texture = 'retain fabric weave and hair strands'
  rendering_intent.cleanliness = 'Do not include any interface overlays, labels, or text such as "BACKGROUND", "SUBJECT", or "LOGO" from the reference composites. The final image must look natural with no UI markings.'

  // Step 10: Build final structured object
  const structured: Record<string, unknown> = {}
  
  const hasKeys = (obj: unknown): boolean => 
    typeof obj === 'object' && obj !== null && Object.keys(obj).length > 0

  if (hasKeys(scene.environment) || hasKeys(scene)) {
    structured.scene = { ...scene }
  }
  if (hasKeys(subject)) {
    structured.subject = { ...subject }
  }
  if (hasKeys(framing_composition)) {
    structured.framing_composition = { ...framing_composition }
  }
  if (hasKeys(camera)) {
    structured.camera = { ...camera }
  }
  if (hasKeys(lighting)) {
    structured.lighting = { ...lighting }
  }
  if (hasKeys(rendering_intent)) {
    structured.rendering_intent = { ...rendering_intent }
  }

  // Step 11: Build final prompt string
  const preface = 'Follow the JSON below to generate a professional photo. Only use specified fields; otherwise use sensible defaults.'
  return preface + '\n' + JSON.stringify(structured, null, 2) + '\n[PACKAGE: freepackage]'
}

export const freepackage: StylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'expression'],
  availableBackgrounds: ['office', 'tropical-beach', 'busy-city', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  promptBuilder: (settings, _ctx) => {
    // Apply defaults to any missing values
    const resolvedSettings: PhotoStyleSettings = {
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      shotType: getValueOrDefault(settings.shotType, DEFAULTS.shotType),
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression)
    }

    // clothingColors are expected to be complete at this point

    return buildPrompt(resolvedSettings)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'freepackage',
      version: 1,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      clothingColors: ui.clothingColors || { type: 'user-choice' },
      shotType: ui.shotType,
      expression: ui.expression
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>

      // Background
      const rawBg = r.background as unknown
      let background: PhotoStyleSettings['background']
      if (rawBg && typeof rawBg === 'object') {
        background = rawBg as PhotoStyleSettings['background']
      } else {
        type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'
        const allowed: readonly string[] = ['office', 'neutral', 'gradient', 'custom', 'user-choice', 'tropical-beach', 'busy-city']
        const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
        background = { type: bgType, prompt: (r['backgroundPrompt'] as string) || undefined }
      }

      // Branding
      const rb = r.branding as PhotoStyleSettings['branding'] | undefined
      const hasLogoKey = (b: unknown): b is { logoKey: string } =>
        typeof b === 'object' && b !== null && 'logoKey' in (b as Record<string, unknown>)

      let brandingType: 'include' | 'exclude' | 'user-choice' = 'user-choice'
      const t = (rb as unknown as { type?: 'include' | 'exclude' | 'user-choice' } | undefined)?.type
      if (t === 'include' || t === 'exclude' || t === 'user-choice') {
        brandingType = t
      } else if (hasLogoKey(rb)) {
        brandingType = 'include'
      }
      const branding: PhotoStyleSettings['branding'] = rb
        ? { type: brandingType, logoKey: rb.logoKey, position: rb.position }
        : { type: 'user-choice' }

      // Clothing
      const rawClothing = r.clothing as PhotoStyleSettings['clothing'] | undefined
      const clothing: PhotoStyleSettings['clothing'] = rawClothing
        ? rawClothing.style === 'user-choice'
          ? { style: 'user-choice' }
          : rawClothing
        : DEFAULTS.clothing

      // Clothing colors
      const rawClothingColors = r.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
      let clothingColors: PhotoStyleSettings['clothingColors']
      if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in r)) {
        clothingColors = { type: 'user-choice' }
      } else if (rawClothingColors.type === 'user-choice') {
        clothingColors = { type: 'user-choice' }
      } else {
        clothingColors = {
          type: 'predefined',
          colors: {
            topBase: rawClothingColors.colors?.topBase || DEFAULTS.clothingColors.colors.topBase,
            topCover: rawClothingColors.colors?.topCover || DEFAULTS.clothingColors.colors.topCover,
            bottom: rawClothingColors.colors?.bottom,
            shoes: rawClothingColors.colors?.shoes
          }
        }
      }

      // Shot type
      const shotType: PhotoStyleSettings['shotType'] = 
        (r.shotType as PhotoStyleSettings['shotType']) || DEFAULTS.shotType

      // Expression - migrate legacy 'professional' to 'neutral'
      const rawExpression = r.expression as PhotoStyleSettings['expression'] | undefined
      let expression: PhotoStyleSettings['expression']
      if (!rawExpression) {
        expression = DEFAULTS.expression
      } else if (rawExpression.type === 'professional') {
        expression = { type: 'neutral' }
      } else {
        expression = rawExpression
      }

      return {
        background: background || { type: 'user-choice' },
        branding,
        clothing,
        clothingColors,
        shotType,
        expression
      }
    }
  }
}
