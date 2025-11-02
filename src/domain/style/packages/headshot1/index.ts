import { PhotoStyleSettings, BackgroundSettings } from '@/types/photo-style'
import type { StylePackage } from '../index'
import { generateBackgroundPrompt } from '../../backgrounds'

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
    let placement = 'tastefully placed'
    if (brandingPosition === 'background') placement = 'subtly integrated into the background. It can be like framed and hanging on the wall. Ensure the position and alignment fits well with the wall it is hanging on'
    if (brandingPosition === 'clothing') placement = 'incorporated into the clothing. Ensure that the logo is positioned outside of overlapping elements, like napels.'
    if (brandingPosition === 'elements') placement = 'included as design elements in the composition, preferable on a background wall, a window, or as a frame on the wall. Ensure the branding is inline with the background, eg if the background is fuzzy, also the branding should be fuzzy. Ensure the logo does not just fly in the air. That doesnt make sense. '
    sceneEnv.branding = `Include a tasteful brand logo which you can find in the attached image, with the logo lable. The logo should be${placement}, labeled as logo. Do not copy the label from the image picture.`
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
    const clothingColors = style?.clothingColors as Record<string, unknown> | undefined
    if (clothingColors) {
      const colorParts = []
      const colors = clothingColors.colors as Record<string, unknown>
      if (colors.topCover) colorParts.push(`top cover: ${colors.topCover}`)
      if (colors.topBase) colorParts.push(`base layer: ${colors.topBase}`)
      if (colors.bottom) colorParts.push(`bottom: ${colors.bottom}`)
      if (colors.shoes) colorParts.push(`shoes: ${colors.shoes}`)
      if (colorParts.length > 0) {
        subjectWardrobe.color_palette = colorParts
      }
    }
  }

  const expression = style?.expression as Record<string, unknown> | undefined
  if (expression?.type) {
    subject.pose = { ...(subject.pose as Record<string, unknown> || {}), expression: expression.type }
  }

  // const lightingStyle = style?.lighting as Record<string, unknown> | undefined
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
      framing_composition.shot_type = 'full body portrait, showing the complete subject from head to toe'
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

  const preface = 'Follow the JSON below to generate a professional headshot. Only use specified fields; otherwise use sensible defaults.'
  return preface + '\n' + JSON.stringify(structured)
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
    clothingColors: { colors: { topBase: 'white', topCover: 'navy', bottom: 'gray' } },
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
        if (!cc) return d.clothingColors
        const dc = d.clothingColors?.colors || {}
        return {
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
      // Explicitly save null for undefined (user-choice) so it can be restored
      clothingColors: ui.clothingColors === undefined ? null : ui.clothingColors,
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

      // Clothing colors handling - preserve undefined (user-choice) if it was null
      // null is used to explicitly mark user-choice (undefined gets converted to null in JSON)
      // If field is missing entirely, use defaults for backward compatibility
      const rawClothingColors = r.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
      let clothingColors: PhotoStyleSettings['clothingColors']
      if (rawClothingColors === null) {
        // Explicitly null means user-choice (explicitly saved as such)
        clothingColors = undefined
      } else if (rawClothingColors === undefined || !('clothingColors' in r)) {
        // Missing field means legacy data - use defaults for backward compatibility
        clothingColors = headshot1.defaultSettings.clothingColors
      } else {
        // Use the saved value
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

