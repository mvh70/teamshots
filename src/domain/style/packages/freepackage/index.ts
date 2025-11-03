import { PhotoStyleSettings, BackgroundSettings } from '@/types/photo-style'
import type { StylePackage } from '../index'
import { generateBackgroundPrompt } from '../../backgrounds'

const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down'])

function localBuild(style: Record<string, unknown>, basePrompt?: string): string {
  const scene: Record<string, unknown> = { environment: {} as Record<string, unknown> }
  const subject: Record<string, unknown> = { 
    type: 'subject from the attached image, maintaining the facial structure, identity, and key features of the input image.',
    pose: {}
  }
  const framing_composition: Record<string, unknown> = {}
  const camera: Record<string, unknown> = {}
  const lighting: Record<string, unknown> = {}
  const rendering_intent: Record<string, unknown> = {}
  const post_processing: Record<string, unknown> = {}

  const background = style?.background as BackgroundSettings | undefined
  const sceneEnv = scene.environment as Record<string, unknown>
  
  // Use centralized background repository to generate prompts
  if (background && background.type) {
    const bgPrompt = generateBackgroundPrompt(background)
    Object.assign(sceneEnv, bgPrompt)
  }

  const branding = style?.branding as Record<string, unknown> | undefined
  const brandingType = branding?.type
  const brandingPosition = branding?.position as 'background' | 'clothing' | 'elements' | undefined
  
  // Clothing settings – respect UI values; default only when user-choice
  const clothing = style?.clothing as { style?: string; details?: string; accessories?: string[] } | undefined
  if (clothing) {
    const resolvedStyle = (clothing.style && clothing.style !== 'user-choice') ? clothing.style : 'business casual'
    const resolvedDetails = (clothing.details && clothing.details !== 'user-choice') ? clothing.details : 't-shirt'
    const subjectWardrobe = { style: resolvedStyle, details: resolvedDetails } as Record<string, unknown>
    subject.wardrobe = subjectWardrobe
    if (clothing.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
      subjectWardrobe.accessories = clothing.accessories
    }
    const clothingDetailsValue = typeof clothing['details'] === 'string' ? (clothing['details'] as string).toLowerCase() : ''
    
    // Handle colors from separate clothingColors setting
    const clothingColors = style?.clothingColors as Record<string, unknown> | undefined
    let includeTopCoverColor = false
    if (clothingColors) {
      const colorParts = []
      const colors = clothingColors.colors as { topBase?: string; topCover?: string; bottom?: string; shoes?: string } | undefined
      
      includeTopCoverColor = Boolean(colors?.topCover) && !NO_TOP_COVER_DETAILS.has(clothingDetailsValue)
      if (includeTopCoverColor && colors?.topCover) {
        colorParts.push(`top cover: ${colors.topCover} color`)
      }
      if (colors?.topBase) {
        colorParts.push(`base layer: ${colors.topBase} color`)
        // Add logo information if branding is included
        if (brandingType === 'include' && (!brandingPosition || brandingPosition === 'clothing')) {
          colorParts.push('the base garment features a brand logo from the attached image, positioned prominently on the chest area')
        }
      }
      if (colors?.bottom) {
        colorParts.push(`The trousers are in ${colors.bottom} color`)
      }
      if (colors?.shoes) {
        colorParts.push(`The shoes are in ${colors.shoes} color`)
      }
      
      if (colorParts.length > 0) {
        subjectWardrobe.color_palette = colorParts
      }
    }
    
    // Add pose description based on garment when branding is on clothing
    if (brandingType === 'include' && subject.pose) {
      const clothingStyleValue = resolvedStyle.toLowerCase()
      if (clothingStyleValue.includes('business') || clothingStyleValue.includes('black tie')) {
        (subject.pose as Record<string, unknown>).description = 'elegantly opening the jacket to reveal the logo on the base garment beneath. The jacket should not be fully open but partially unbuttoned to tastefully display the logo'
      } else if (clothingStyleValue.includes('startup')) {
        (subject.pose as Record<string, unknown>).description = 'both hands gently pointing towards the logo on the base garment (t-shirt/hoodie/polo/button down) to draw attention in a natural, professional manner'
      }
    }
  }

  // Branding in environment if not on clothing
  if (brandingType === 'include') {
    // Strict placement by position (default to clothing chest)
    let rules: string
    if (brandingPosition === 'background') {
      rules = 'Place the provided brand logo once as a framed element on a background wall only, aligned with the wall perspective. Do not place on the subject, floors, windows, or floating in space. Keep original colors and aspect ratio.'
    } else if (brandingPosition === 'elements') {
      rules = 'Place the provided brand logo once on a plausible scene element only, such as: a coffee mug label, a laptop sticker, a notebook cover, a standing banner flag, a signboard, or a door plaque. The element must be grounded in the scene (on a desk/floor/wall) and the logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.'
    } else {
      rules = 'Place the provided brand logo exactly once on the center chest area of the base garment (e.g., t‑shirt/hoodie/shirt). Do not place the logo on outer layers (jackets/coats), background, walls, floors, signs, accessories, or skin. Do not create patterns or duplicates. Keep original aspect ratio and colors; no stylization or warping. The logo size should be modest and proportional to the garment.'
    }
    ;(subject as Record<string, unknown>).branding_rules = rules
  } else if (brandingType === 'exclude') {
    sceneEnv.branding = 'no brand marks'
  }

  // Expression handling
  const expression = style?.expression as Record<string, unknown> | undefined
  const expressionType = (expression?.['type'] as string | undefined) || 'user-choice'
  if (expressionType && expressionType !== 'user-choice') {
    const map: Record<string, string> = {
      professional: 'professional, approachable expression with a subtle smile',
      friendly: 'friendly warm smile',
      serious: 'serious neutral expression',
      confident: 'confident slight smile',
      happy: 'happy smile',
      sad: 'subtle sad expression',
      neutral: 'neutral expression',
      thoughtful: 'thoughtful look'
    }
    const desc = map[expressionType] || 'neutral expression'
    subject.pose = { ...(subject.pose as Record<string, unknown>), expression: desc }
  }

  // Shot type handling
  const shotType = style?.shotType as Record<string, unknown> | undefined
  const shotTypeValue = shotType?.type as string | undefined
  if (shotTypeValue && shotTypeValue !== 'user-choice') {
    if (shotTypeValue === 'headshot') {
      framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
    } else if (shotTypeValue === 'midchest') {
      framing_composition.shot_type = 'mid-chest portrait, showing from chest up with positive space around the subject'
    } else if (shotTypeValue === 'full-body') {
      framing_composition.shot_type = 'full body portrait, showing the complete subject from head to toe; include the entire body with feet fully visible, no cropping at ankles or knees; keep a bit of floor visible beneath the shoes'
      // For full body, bias toward a wider focal length and add explicit framing rules
      camera.lens = { focal_length_mm: 35, type: 'prime', character: 'neutral rendering, low distortion' }
      ;(framing_composition as Record<string, unknown>).composition_rules = 'Frame the subject head-to-toe within a vertical canvas; maintain comfortable headroom and footroom; do not crop any part of the body; step back to capture the entire person if needed.'
    } else {
      // Default fallback for unrecognized shot types
      framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
    }
  } else {
    // Default when shotType is missing or 'user-choice'
    framing_composition.shot_type = 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
  }

  framing_composition.orientation = framing_composition.orientation || 'vertical'
  framing_composition.background_separation = framing_composition.background_separation || 'soft'

  camera.sensor = 'full-frame mirrorless'
  camera.lens = { focal_length_mm: 85, type: 'prime', character: 'neutral rendering, low distortion' }
  camera.settings = { aperture: 'f/2.8', shutter_speed: '1/200', iso: 200, white_balance: 'auto', focus: 'eye-AF' }

  lighting.quality = 'soft, natural'

  rendering_intent.texture = 'retain fabric weave and hair strands'
  rendering_intent.cleanliness = 'Do not include any interface overlays, labels, or text such as "BACKGROUND", "SUBJECT", or "LOGO" from the reference composites. The final image must look natural with no UI markings.'

  const structured: Record<string, unknown> = {}
  const hasKeys = (obj: unknown): boolean => typeof obj === 'object' && obj !== null && Object.keys(obj as Record<string, unknown>).length > 0
  if (hasKeys(sceneEnv)) {
    if (!hasKeys(scene)) scene.environment = { ...sceneEnv }
    structured.scene = { ...scene }
  } else if (hasKeys(scene)) {
    structured.scene = { ...scene }
  }
  if (hasKeys(subject)) structured.subject = subject
  if (hasKeys(framing_composition)) structured.framing_composition = framing_composition
  if (hasKeys(camera)) structured.camera = camera
  if (hasKeys(lighting)) structured.lighting = lighting
  if (hasKeys(rendering_intent)) structured.rendering_intent = rendering_intent
  if (hasKeys(post_processing)) structured.post_processing = post_processing

  if (basePrompt) {
    structured.notes = basePrompt
  }

  const preface = 'Follow the JSON below to generate a professional photo. Only use specified fields; otherwise use sensible defaults.'
  // Append a lightweight package marker for debugging/trace without changing semantics
  return preface + '\n' + JSON.stringify(structured) + '\n[PACKAGE: freepackage]'
}

export const freepackage: StylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'expression'],
  availableBackgrounds: ['office', 'tropical-beach', 'busy-city', 'neutral', 'gradient', 'custom'],
  // Free package defaults - business casual with t-shirt and jacket
  defaultSettings: {
    background: { type: 'neutral', color: '#f2f2f2' },
    branding: { type: 'exclude' },
    clothing: { 
      style: 'startup', 
      details: 't-shirt'
    },
    clothingColors: {
      colors: {
        topBase: '#ffffff', // Default white t-shirt
        topCover: '#4a5568' // Default gray jacket
      }
    },
    shotType: { type: 'headshot' },
    expression: { type: 'professional' }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  promptBuilder: (settings, _ctx) => {
    // Merge provided settings with package defaults; replace 'user-choice' with defaults
    const d = freepackage.defaultSettings
    const withDefaults: PhotoStyleSettings = {
      background: (() => {
        const bg = settings.background
        if (!bg || bg.type === 'user-choice') return d.background
        if (bg.type === 'neutral' && !bg.color && d.background?.color) return { ...bg, color: d.background.color }
        return bg
      })(),
      branding: (() => {
        const b = settings.branding
        if (!b || b.type === 'user-choice') return d.branding
        return b
      })(),
      clothing: (() => {
        const c = settings.clothing
        if (!c || c.style === 'user-choice') return d.clothing
        return { ...c }
      })(),
      clothingColors: (() => {
        const cc = settings.clothingColors
        if (!cc) return d.clothingColors
        return {
          colors: {
            topBase: cc.colors?.topBase || d.clothingColors?.colors?.topBase || '#ffffff',
            topCover: cc.colors?.topCover || d.clothingColors?.colors?.topCover || '#4a5568',
            bottom: cc.colors?.bottom || d.clothingColors?.colors?.bottom,
            shoes: cc.colors?.shoes || d.clothingColors?.colors?.shoes
          }
        }
      })(),
      shotType: (() => {
        const st = settings.shotType
        if (!st || st.type === 'user-choice') return d.shotType
        return st
      })(),
      expression: (() => {
        const ex = settings.expression
        if (!ex || ex.type === 'user-choice') return d.expression || { type: 'professional' }
        return ex
      })()
    }

    return localBuild(withDefaults as unknown as Record<string, unknown>)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'freepackage',
      version: 1,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      // Explicitly save null for undefined (user-choice) so it can be restored
      clothingColors: ui.clothingColors === undefined ? null : ui.clothingColors,
      shotType: ui.shotType,
      expression: ui.expression
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
      
      // Background handling
      const rawBg = r.background as unknown
      let background: PhotoStyleSettings['background']
      if (rawBg && typeof rawBg === 'object') {
        background = rawBg as PhotoStyleSettings['background']
      } else {
        type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'
        const allowed: readonly string[] = ['office','neutral','gradient','custom','user-choice','tropical-beach','busy-city']
        const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
        background = { type: bgType, prompt: (r['backgroundPrompt'] as string) || undefined }
      }

      // Branding handling
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

      // Clothing handling - preserve user-choice if set, otherwise use saved value or default
      const rawClothing = r.clothing as PhotoStyleSettings['clothing'] | undefined
      const clothing: PhotoStyleSettings['clothing'] = rawClothing
        ? rawClothing.style === 'user-choice'
          ? { style: 'user-choice' }
          : rawClothing
        : freepackage.defaultSettings.clothing

      // Clothing colors handling - preserve undefined (user-choice) if it was null
      // null is used to explicitly mark user-choice (undefined gets converted to null in JSON)
      // If field is missing entirely, use defaults for backward compatibility
      const rawClothingColors = r.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
      let clothingColors: PhotoStyleSettings['clothingColors']
      if (rawClothingColors === null) {
        // Explicitly null means user-choice (explicitly saved as such)
        clothingColors = undefined
      } else if (rawClothingColors === undefined || !('clothingColors' in r)) {
        // Missing field: treat as user-choice to avoid unintentionally forcing defaults
        clothingColors = undefined
      } else {
        // Use the saved value
        clothingColors = rawClothingColors
      }

      // Shot type handling
      const shotType: PhotoStyleSettings['shotType'] = (r.shotType as PhotoStyleSettings['shotType']) || freepackage.defaultSettings.shotType
      const expression: PhotoStyleSettings['expression'] = (r.expression as PhotoStyleSettings['expression']) || freepackage.defaultSettings.expression

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

