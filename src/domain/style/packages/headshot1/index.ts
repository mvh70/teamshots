import { PhotoStyleSettings, BackgroundSettings } from '@/types/photo-style'
import type { StylePackage } from '../index'
import { generateBackgroundPrompt } from '../../backgrounds'

const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down'])

// Local reference to builder (currently in roDelete)
function localBuild(style: Record<string, unknown>, basePrompt?: string): string {
  const scene: Record<string, unknown> = { environment: {} as Record<string, unknown> }
  const subject: Record<string, unknown> = { type: 'subject from the attached image, maintaining the facial structure, identity, and key features of the input image.' }
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
  const brandingPosition = branding?.position
  if (brandingType === 'include') {
    // Strict placement constraints by position
    let rules: string
    if (brandingPosition === 'background') {
      rules = 'Place the provided brand logo once as a framed element on a background wall only, aligned with the wall perspective. Do not place on the subject, floors, windows, or floating in space. Keep original colors and aspect ratio.'
    } else if (brandingPosition === 'elements') {
      rules = 'Place the provided brand logo once on a plausible scene element only, such as: a coffee mug label, a laptop sticker, a notebook cover, a standing banner flag, a signboard, or a door plaque. The element must be grounded in the scene (on a desk/floor/wall) and the logo must follow the element perspective without warping or repeating. Do not place on the person, skin, or clothing when using elements mode; do not float in mid-air; no duplicates or patterns.'
    } else {
      // default or clothing
      rules = 'Place the provided brand logo exactly once on the center chest area of the clothing (t-shirt/hoodie/polo/button down), or on the arms only. Do not place the logo on the jacket exterior, background, walls, floors, signs, accessories, or skin. Do not duplicate or create patterns. Keep original colors and aspect ratio.'
    }
    ;(subject as Record<string, unknown>).branding_rules = rules
  }
  if (brandingType === 'exclude') sceneEnv.branding = 'no brand marks'

  const styleSettings = style?.style as Record<string, unknown> | undefined
  const preset = styleSettings?.preset
  if (preset === 'corporate') {
    scene.mood = 'professional, confident'
    rendering_intent.photorealism = 'high'
  } else if (preset === 'casual') {
    scene.mood = 'approachable, relaxed'
  } else if (preset === 'cinematic') {
    scene.mood = 'cinematic, refined'
  }

  const clothing = style?.clothing as Record<string, unknown> | undefined
  const clothingDetailsValue = typeof clothing?.details === 'string' ? (clothing.details as string).toLowerCase() : ''
  // Support both 'style' (new) and 'type' (legacy) fields
  const clothingStyle = clothing?.style || clothing?.type
  if (clothingStyle) {
    const subjectWardrobe = { 
      style: clothingStyle,
      details: clothing.details
    } as Record<string, unknown>
    subject.wardrobe = subjectWardrobe
    if (clothing.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
      subjectWardrobe.accessories = clothing.accessories
    }
    // Handle colors from separate clothingColors setting
    const clothingColors = style?.clothingColors as { type?: string; colors?: { topBase?: string; topCover?: string; bottom?: string; shoes?: string } } | undefined
    if (clothingColors && clothingColors.type !== 'user-choice') {
      const colorParts = []
      const colors = clothingColors.colors
      const includeTopCoverColor = Boolean(colors?.topCover) && !NO_TOP_COVER_DETAILS.has(clothingDetailsValue)
      if (includeTopCoverColor) colorParts.push(`top cover: ${colors?.topCover} color`)
      if (colors?.topBase) colorParts.push(`base layer: ${colors.topBase} color`)
      if (colors?.bottom) colorParts.push(`The trousers are in ${colors.bottom} color`)
      if (colors?.shoes) colorParts.push(`The shoes are in ${colors.shoes} color`)
      // If branding is included and position is clothing, ensure logo instruction on base garment
      if (brandingType === 'include' && (!brandingPosition || brandingPosition === 'clothing')) {
        colorParts.push('the clothing features a brand logo from the attached image, positioned prominently on the chest area of the base garment')
      }
      if (colorParts.length > 0) {
        subjectWardrobe.color_palette = colorParts
      }
    }
  }

  const expression = style?.expression as Record<string, unknown> | undefined
  if (expression?.type) {
    const expr = expression.type as string
    const expressionMap: Record<string, string> = {
      happy: 'genuine smile, slight teeth visible, eyes engaged',
      serious: 'neutral mouth, focused eyes, composed demeanor',
      sad: 'subtle downturned mouth, soft gaze',
      neutral: 'relaxed mouth, natural expression',
      confident: 'subtle smile or neutral lips, chin slightly raised, direct eye contact',
      friendly: 'soft smile, approachable',
      professional: 'calm and composed, minimal smile'
    }
    const expressionText = expressionMap[expr] || 'natural expression'
    subject.pose = { ...(subject.pose as Record<string, unknown> || {}), expression: expressionText }
  }

  // const lightingStyle = style?.lighting as Record<string, unknown> | undefined
  // Clothing colors handling - incorporate into subject wardrobe palette
  const clothingColors = style?.clothingColors as { type?: string; colors?: { topBase?: string; topCover?: string; bottom?: string; shoes?: string } } | undefined
  if (clothingColors && clothingColors.type !== 'user-choice' && clothingColors.colors) {
    const colors = clothingColors.colors
    const palette: string[] = []
    const includeTopCoverColor = Boolean(colors.topCover) && !NO_TOP_COVER_DETAILS.has(clothingDetailsValue)
    if (includeTopCoverColor) palette.push(`If there is a top cover, like a jacker, its color is: ${colors.topCover}`)
    if (colors.topBase) palette.push(`If there is a visible base layer, like a shirt, its color is: ${colors.topBase}`)
    if (colors.bottom) palette.push(`If there are trousers, their color is: ${colors.bottom}`)
    if (colors.shoes) palette.push(`If shoes are visible their color is: ${colors.shoes}`)
    if (palette.length > 0) {
      (subject.wardrobe as Record<string, unknown> | undefined) ||= {} as Record<string, unknown>
      ;(subject.wardrobe as Record<string, unknown>).color_palette = palette
    }
  }

  // const lightType = lightingStyle?.type
  // if (lightType === 'natural') {
  //   lighting.key = 'soft window key light'
  //   lighting.fill = 'gentle fill opposite window'
  //   lighting.quality = 'soft'
  // } else if (lightType === 'studio') {
  //   lighting.key = 'large softbox key slightly above eye level'
  //   lighting.fill = 'secondary softbox or reflector ~1 stop under key'
  //   lighting.quality = 'soft, controlled'
  // } else if (lightType === 'soft') {
  //   lighting.quality = 'very soft, diffuse'
  // } else if (lightType === 'dramatic') {
  //   lighting.quality = 'soft key with higher contrast; controlled spill'
  // }

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
      camera.lens = { focal_length_mm: 35, type: 'prime', character: 'neutral rendering, low distortion' }
      ;(framing_composition as Record<string, unknown>).composition_rules = 'Frame the subject head-to-toe within a vertical canvas; maintain comfortable headroom and footroom; do not crop any part of the body; step back to capture the entire person if needed.'
    }
  } else {
    framing_composition.shot_type = framing_composition.shot_type || 'head-and-shoulders portrait, with ample headroom and negative space above their head, ensuring the top of their head is not cropped'
  }

  framing_composition.orientation = framing_composition.orientation || 'vertical'
  framing_composition.background_separation = framing_composition.background_separation || 'soft'

  camera.sensor = 'full-frame mirrorless'
  camera.lens = { focal_length_mm: 85, type: 'prime', character: 'neutral rendering, low distortion' }
  camera.settings = { aperture: 'f/2.8', shutter_speed: '1/200', iso: 200, white_balance: 'auto', focus: 'eye-AF' }

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
  return preface + '\n' + JSON.stringify(structured) + '\n[PACKAGE: headshot1]'
}

export const headshot1: StylePackage = {
  id: 'headshot1',
  label: 'HeadShot1',
  version: 1,
  visibleCategories: ['background','branding','clothing','clothingColors','shotType','style','expression'],
  availableBackgrounds: ['office', 'neutral', 'gradient', 'custom'],
  // Package-specific sane defaults used when user leaves a category as "user-choice"
  defaultSettings: {
    background: { type: 'neutral', color: '#f2f2f2' },
    branding: { type: 'exclude' },
    clothing: { style: 'business', details: 'formal' },
    clothingColors: { type: 'predefined', colors: { topBase: 'white', topCover: 'navy', bottom: 'gray' } },
    shotType: { type: 'headshot' },
    style: { type: 'preset', preset: 'corporate' },
    expression: { type: 'professional' }
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  promptBuilder: (settings, _ctx) => {
    // Merge provided settings with package defaults; replace 'user-choice' with defaults
    const d = headshot1.defaultSettings
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
        if (!cc || cc.type === 'user-choice') return d.clothingColors
        const dc = d.clothingColors?.colors || {}
        return {
          type: 'predefined',
          colors: {
            topBase: cc.colors?.topBase || dc.topBase,
            topCover: cc.colors?.topCover || dc.topCover,
            bottom: cc.colors?.bottom || dc.bottom,
            shoes: cc.colors?.shoes || dc.shoes
          }
        }
      })(),
      shotType: (() => {
        const st = settings.shotType
        if (!st || st.type === 'user-choice') return d.shotType
        return st
      })(),
      style: (() => {
        const s = settings.style
        if (!s || s.type === 'user-choice') return d.style
        if (s.type === 'preset' && !s.preset) return d.style
        return s
      })(),
      expression: (() => {
        const e = settings.expression
        if (!e || e.type === 'user-choice') return d.expression
        return e
      })()
    }

    return localBuild(withDefaults as unknown as Record<string, unknown>)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'headshot1',
      version: 1,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      // Save as-is, type field now handles user-choice state
      clothingColors: ui.clothingColors || { type: 'user-choice' },
      shotType: ui.shotType,
      style: ui.style,
      expression: ui.expression
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
      // background: accept legacy (type/prompt) and new full object
      const rawBg = r.background as unknown
      let background: PhotoStyleSettings['background']
      if (rawBg && typeof rawBg === 'object') {
        background = rawBg as PhotoStyleSettings['background']
      } else {
        type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice'
        const allowed: readonly string[] = ['office','neutral','gradient','custom','user-choice']
        const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
        background = { type: bgType, prompt: (r['backgroundPrompt'] as string) || undefined }
      }

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

      // Clothing colors handling - now uses type field like other categories
      const rawClothingColors = r.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
      let clothingColors: PhotoStyleSettings['clothingColors']
      if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in r)) {
        // Missing or null: treat as user-choice for backward compatibility
        clothingColors = { type: 'user-choice' }
      } else if (rawClothingColors.type === 'user-choice') {
        // Explicitly user-choice
        clothingColors = { type: 'user-choice' }
      } else if (!rawClothingColors.type) {
        // Legacy format without type field - assume predefined if colors exist
        clothingColors = {
          type: 'predefined',
          colors: rawClothingColors.colors
        }
      } else {
        clothingColors = rawClothingColors
      }

      // Shot type handling
      const shotType: PhotoStyleSettings['shotType'] = (r.shotType as PhotoStyleSettings['shotType']) || headshot1.defaultSettings.shotType

      return {
        background: background || { type: 'user-choice' },
        branding,
        clothing: (r.clothing as PhotoStyleSettings['clothing']) || { style: 'user-choice' },
        clothingColors,
        shotType,
        style: (r.style as PhotoStyleSettings['style']) || { type: 'preset', preset: 'corporate' },
        expression: (r.expression as PhotoStyleSettings['expression']) || { type: 'user-choice' }
      }
    }
  }
}

