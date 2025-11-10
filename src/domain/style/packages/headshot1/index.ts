import { PhotoStyleSettings, BackgroundSettings } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import { generateBackgroundPrompt } from '../../backgrounds'
import {
  resolveShotType,
  resolveFocalLength,
  resolveAperture,
  resolveLightingQuality,
  resolveShutterSpeed,
  getLightingDirectionLabel
} from '../camera-presets'
import { computeCriticalOverrides } from '../critical-overrides'
import {
  resolveBodyAngle,
  resolveHeadPosition,
  resolveShoulderPosition,
  resolveWeightDistribution,
  resolveArmPosition,
  resolveSittingPose,
  CHIN_TECHNIQUE_NOTE,
  getExpressionLabel
} from '../pose-presets'
import { applyStandardPreset, getDefaultPresetSettings } from '../standard-settings'

const HEADSHOT_PRESET_DEFAULTS = getDefaultPresetSettings('corporate-headshot')

const NO_TOP_COVER_DETAILS = new Set(['t-shirt', 'hoodie', 'polo', 'button-down'])

const DEFAULTS = {
  ...HEADSHOT_PRESET_DEFAULTS,
  background: { type: 'neutral' as const, color: '#f2f2f2' },
  branding: { type: 'exclude' as const },
  clothing: { style: 'business' as const, details: 'formal' },
  clothingColors: {
    type: 'predefined' as const,
    colors: { topBase: 'white', topCover: 'navy', bottom: 'gray' }
  },
  style: { type: 'preset' as const, preset: 'corporate' as const },
  expression: { type: 'professional' as const },
  subjectCount: '1' as const,
  usageContext: 'general' as const
}

type NestedRecord = Record<string, unknown>;

const isNestedRecord = (value: unknown): value is NestedRecord =>
  typeof value === 'object' && value !== null;

const setPath = (obj: NestedRecord, path: string, value: unknown): void => {
  const segments = path.split('.')
  let current: NestedRecord = obj
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const next = current[segment]
    if (!isNestedRecord(next)) {
      const child: NestedRecord = {}
      current[segment] = child
      current = child
    } else {
      current = next
    }
  }
  current[segments[segments.length - 1]] = value
}

const valuesEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

function buildPrompt(settings: PhotoStyleSettings): string {
  const { preset, settings: effectiveSettings } = applyStandardPreset(
    settings.presetId || headshot1.defaultPresetId,
    settings
  )
  const presetDefaults = getDefaultPresetSettings(preset.id)

  const overrides: Record<string, unknown> = {}
  const payload: NestedRecord = {
    meta: {
      preset: preset.label,
      overrides
    },
    scene: {
      environment: {
        location_type: preset.defaults.environment.description,
        distance_from_background_ft: preset.defaults.environment.distanceFromSubjectFt ?? 6,
        notes: preset.defaults.environment.notes ?? []
      }
    },
    subject: {
      identity: {
        source: 'composite selfies',
        immutable_features: 'The images in the selfies show the exact same individual. Your primary task is to synthesize a single, photorealistic, and coherent identity from these images. Do not average or blend features in a way that creates a new person. Pay special attention to facial features, and skin tone. Use the selfies to understand the 3D structure of the face from different angles. The final generated person must be clearly identifiable as the person. Do not alter the fundamental facial structure, eye color, eye shape, nose shape, or unique skin details like moles, scars, or freckles visible in the source selfies.'
      },
      pose: {
        body_angle: '',
        head_position: '',
        chin_technique: CHIN_TECHNIQUE_NOTE,
        shoulder_position: '',
        weight_distribution: '',
        arms: '',
        expression: getExpressionLabel(presetDefaults.expression?.type)
      },
      wardrobe: {},
      branding: {}
    },
    framing: {
      shot_type: '',
      crop_points: '',
      orientation: preset.defaults.orientation ?? 'vertical',
      composition: preset.defaults.composition.framingNotes?.[0] ?? 'centered',
      headroom_percent: preset.defaults.composition.headroomPercent ?? 12,
      shows: ''
    },
    camera: {
      sensor: 'full-frame mirrorless',
      lens: {
        focal_length_mm: 85,
        type: 'prime',
        character: 'Portrait standard focal length with flattering compression and separation.'
      },
      settings: {
        aperture: 'f/4.0',
        shutter_speed: '1/200',
        iso: preset.defaults.iso ?? 100,
        white_balance: '5500K',
        focus: 'eye-AF'
      }
    },
    lighting: {
      quality: 'Soft Diffused',
      direction: getLightingDirectionLabel(preset.defaults.lighting.direction),
      setup: preset.defaults.lighting.setupNotes ?? ['Softbox (3x4ft or larger) + reflector opposite'],
      color_temperature: preset.defaults.lighting.colorTempKelvin
        ? `${preset.defaults.lighting.colorTempKelvin}K`
        : '5500K',
      description: 'Flattering professional lighting with gentle transitions and minimal harsh shadows.'
    },
    rendering: {
      texture: 'retain fabric weave, skin texture, hair detail and facial features like wrinkles, freckles, moles, etc.',
      cleanliness: 'no UI overlays, labels, or text in final image',
      framing: 'the original selfies of the subject should not be shown in the final image',
      quality: 'print-ready, high resolution'
    }
  }

  const presetShotConfig = resolveShotType(presetDefaults.shotType?.type)
  const presetFocalConfig = resolveFocalLength(presetDefaults.focalLength as string | undefined)
  const presetApertureConfig = resolveAperture(presetDefaults.aperture as string | undefined)
  const presetLightingConfig = resolveLightingQuality(presetDefaults.lightingQuality as string | undefined)
  const presetShutterConfig = resolveShutterSpeed(presetDefaults.shutterSpeed as string | undefined)
  const presetHeadroomPercent = preset.defaults.composition.headroomPercent ?? 12
  const presetBackgroundDistanceFt = preset.defaults.environment.distanceFromSubjectFt ?? 6
  const shotTypeConfig = resolveShotType(effectiveSettings.shotType?.type)
  const focalConfig = resolveFocalLength(effectiveSettings.focalLength as string | undefined)
  const apertureConfig = resolveAperture(effectiveSettings.aperture as string | undefined)
  const shutterConfig = resolveShutterSpeed(effectiveSettings.shutterSpeed as string | undefined)
  const presetBodyConfig = resolveBodyAngle(presetDefaults.bodyAngle as string | undefined)
  const presetHeadConfig = resolveHeadPosition(presetDefaults.headPosition as string | undefined)
  const presetShoulderConfig = resolveShoulderPosition(presetDefaults.shoulderPosition as string | undefined)
  const presetWeightConfig = resolveWeightDistribution(presetDefaults.weightDistribution as string | undefined)
  const presetArmConfig = resolveArmPosition(presetDefaults.armPosition as string | undefined)
  const presetSittingConfig =
    presetDefaults.sittingPose && presetDefaults.sittingPose !== 'user-choice'
      ? resolveSittingPose(presetDefaults.sittingPose as string | undefined)
      : undefined

  const activeBodyConfig = resolveBodyAngle(effectiveSettings.bodyAngle as string | undefined)
  const activeHeadConfig = resolveHeadPosition(effectiveSettings.headPosition as string | undefined)
  const activeShoulderConfig = resolveShoulderPosition(effectiveSettings.shoulderPosition as string | undefined)
  const activeWeightConfig = resolveWeightDistribution(effectiveSettings.weightDistribution as string | undefined)
  const activeArmConfig = resolveArmPosition(effectiveSettings.armPosition as string | undefined)
  const hasActiveSitting =
    effectiveSettings.sittingPose && effectiveSettings.sittingPose !== 'user-choice'
  const activeSittingConfig = hasActiveSitting
    ? resolveSittingPose(effectiveSettings.sittingPose as string | undefined)
    : undefined

  setPath(payload, 'subject.pose.body_angle', presetBodyConfig.description)
  setPath(payload, 'subject.pose.head_position', presetHeadConfig.description)
  setPath(payload, 'subject.pose.shoulder_position', presetShoulderConfig.description)
  setPath(payload, 'subject.pose.weight_distribution', presetWeightConfig.description)
  setPath(payload, 'subject.pose.arms', presetArmConfig.description)
  if (presetSittingConfig) {
    setPath(payload, 'subject.pose.sitting_position', presetSittingConfig.description)
  }

  setPath(payload, 'framing.shot_type', presetShotConfig.label)
  setPath(payload, 'framing.crop_points', presetShotConfig.framingDescription)
  setPath(payload, 'framing.shows', presetShotConfig.framingDescription)
  setPath(payload, 'camera.lens', {
    focal_length_mm: presetFocalConfig.mm,
    type: presetFocalConfig.lensType,
    character: presetFocalConfig.description
  })
  setPath(payload, 'camera.settings.aperture', presetApertureConfig.value)
  setPath(payload, 'camera.settings.shutter_speed', presetShutterConfig.value)
  setPath(payload, 'lighting.quality', presetLightingConfig.label)
  setPath(payload, 'lighting.description', presetLightingConfig.description)

  const applyOverride = (key: string, path: string, value: unknown, defaultValue: unknown) => {
    setPath(payload, path, value)
    if (!valuesEqual(value, defaultValue)) {
      overrides[key] = value
    }
  }

  applyOverride('shot_type', 'framing.shot_type', shotTypeConfig.label, presetShotConfig.label)
  setPath(payload, 'framing.crop_points', shotTypeConfig.framingDescription)
  setPath(payload, 'framing.shows', shotTypeConfig.framingDescription)

  setPath(payload, 'subject.pose.body_angle', activeBodyConfig.description)
  setPath(payload, 'subject.pose.head_position', activeHeadConfig.description)
  setPath(payload, 'subject.pose.shoulder_position', activeShoulderConfig.description)
  setPath(payload, 'subject.pose.weight_distribution', activeWeightConfig.description)
  setPath(payload, 'subject.pose.arms', activeArmConfig.description)
  setPath(payload, 'subject.pose.expression', getExpressionLabel(effectiveSettings.expression?.type))
  setPath(payload, 'subject.pose.description', 'Professional posture facing camera with relaxed confidence.')
  if (activeSittingConfig) {
    setPath(payload, 'subject.pose.sitting_position', activeSittingConfig.description)
  }

  const clothing = effectiveSettings.clothing
  const clothingStyle = clothing?.style || DEFAULTS.clothing.style
  const clothingDetails = clothing?.details || DEFAULTS.clothing.details
  const clothingDetailsLower = clothingDetails.toLowerCase()
  const clothingColors = effectiveSettings.clothingColors

  const wardrobe: Record<string, unknown> = {
    style: clothingStyle,
    details: clothingDetails,
    notes: clothingStyle === 'business' ? 'Tailored fit, pressed fabrics, polished appearance.' : undefined
  }
  if (clothing?.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
    wardrobe.accessories = clothing.accessories
  }
  if (clothingColors && clothingColors.type === 'predefined' && clothingColors.colors) {
    const palette: Record<string, string> = {}
    if (clothingColors.colors.topBase) palette.base_layer = clothingColors.colors.topBase
    if (clothingColors.colors.topCover && !NO_TOP_COVER_DETAILS.has(clothingDetailsLower)) {
      palette.outer_layer = clothingColors.colors.topCover
    }
    if (clothingColors.colors.bottom) palette.bottom = clothingColors.colors.bottom
    if (clothingColors.colors.shoes) palette.shoes = clothingColors.colors.shoes
    if (Object.keys(palette).length > 0) {
      wardrobe.color_palette = palette
    }
  }
  setPath(payload, 'subject.wardrobe', wardrobe)

  const branding = effectiveSettings.branding as PhotoStyleSettings['branding'] | undefined
  if (branding?.type === 'include') {
    if (branding.position === 'background') {
      setPath(payload, 'subject.branding', {
        mode: 'background element',
        rules: [
          'Place once on a background wall element, aligned with perspective.',
          'Do not place on subject, floors, windows, or floating in space.',
          'Keep original aspect ratio and colors.'
        ]
      })
    } else if (branding.position === 'elements') {
      setPath(payload, 'subject.branding', {
        mode: 'scene element',
        allowed_elements: ['coffee mug label', 'laptop sticker', 'notebook cover', 'standing banner', 'door plaque'],
        rules: [
          'Ground the element in the scene with correct perspective.',
          'Single placement only. No duplicates or floating marks.',
          'Maintain original colors and aspect ratio.'
        ]
      })
    } else {
      setPath(payload, 'subject.branding', {
        mode: 'apparel',
        placement: 'upper chest of base garment or sleeve if appropriate',
        rules: [
          'Keep logo off jackets/coats and outer layers.',
          'No duplication, patterns, or stylization.',
          'Preserve original colors and aspect ratio.'
        ]
      })
    }
  } else {
    setPath(payload, 'subject.branding', {
      rules: ['no brand marks visible']
    })
  }

  const backgroundSettings = effectiveSettings.background as BackgroundSettings | undefined
  const defaultLocation = preset.defaults.environment.description
  let environmentDistance = presetBackgroundDistanceFt
  if (backgroundSettings) {
    const bgPrompt = generateBackgroundPrompt(backgroundSettings)
    if (bgPrompt.location_type) {
      applyOverride('environment', 'scene.environment.location_type', bgPrompt.location_type, defaultLocation)
    }
    if (bgPrompt.color_palette) {
      setPath(payload, 'scene.environment.color_palette', bgPrompt.color_palette)
    }
    if (bgPrompt.description) {
      setPath(payload, 'scene.environment.description', bgPrompt.description)
    }
    if (bgPrompt.branding) {
      setPath(payload, 'scene.environment.branding', bgPrompt.branding)
    }
  }

  const criticalOverrides = computeCriticalOverrides({
    presetId: preset.id,
    shotType: shotTypeConfig.id,
    subjectCount: effectiveSettings.subjectCount,
    usageContext: effectiveSettings.usageContext,
    baseBackgroundDistanceFt: environmentDistance
  })

  const finalFocalConfig = criticalOverrides.focalLength ?? focalConfig
  setPath(payload, 'camera.lens', {
    focal_length_mm: finalFocalConfig.mm,
    type: finalFocalConfig.lensType,
    character: finalFocalConfig.description
  })
  if (criticalOverrides.focalLength && criticalOverrides.focalLength.mm !== focalConfig.mm) {
    overrides.focal_length_mm = criticalOverrides.focalLength.mm
  }

  const finalApertureConfig = criticalOverrides.aperture ?? apertureConfig
  setPath(payload, 'camera.settings.aperture', finalApertureConfig.value)
  if (criticalOverrides.aperture && criticalOverrides.aperture.value !== apertureConfig.value) {
    overrides.aperture = criticalOverrides.aperture.value
  }
  setPath(payload, 'camera.settings.shutter_speed', shutterConfig.value)

  if (criticalOverrides.subjectScalePercent !== undefined) {
    setPath(payload, 'framing.subject_scale_percent', criticalOverrides.subjectScalePercent)
    overrides.subject_scale_percent = criticalOverrides.subjectScalePercent
  }

  const finalHeadroomPercent = criticalOverrides.headroomPercent ?? presetHeadroomPercent
  applyOverride('headroom_percent', 'framing.headroom_percent', finalHeadroomPercent, presetHeadroomPercent)

  environmentDistance = criticalOverrides.backgroundDistanceFt ?? environmentDistance
  applyOverride(
    'background_distance_ft',
    'scene.environment.distance_from_background_ft',
    environmentDistance,
    presetBackgroundDistanceFt
  )

  setPath(payload, 'lighting.setup', preset.defaults.lighting.setupNotes ?? ['Softbox (3x4ft or larger) + reflector opposite'])
  setPath(payload, 'lighting.direction', getLightingDirectionLabel(preset.defaults.lighting.direction))
  setPath(payload, 'lighting.color_temperature', preset.defaults.lighting.colorTempKelvin ? `${preset.defaults.lighting.colorTempKelvin}K` : '5500K')

  if (Object.keys(overrides).length === 0) {
    const meta = payload.meta as Record<string, unknown>
    delete meta.overrides
  }

  return JSON.stringify(payload, null, 2)
}

export const headshot1: ClientStylePackage = {
  id: 'headshot1',
  label: 'HeadShot1',
  version: 1,
  visibleCategories: ['background','branding','clothing','clothingColors','shotType','aspectRatio','focalLength','aperture','lightingQuality','shutterSpeed','bodyAngle','headPosition','shoulderPosition','weightDistribution','armPosition','sittingPose','style','expression'],
  availableBackgrounds: ['office', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  defaultPresetId: 'corporate-headshot',
  promptBuilder: (settings, _ctx) => {
    void _ctx
    const d = headshot1.defaultSettings
    const resolvedSittingPoseId =
      settings.sittingPose && settings.sittingPose !== 'user-choice'
        ? resolveSittingPose(settings.sittingPose as string | undefined).id
        : undefined

    const resolved: PhotoStyleSettings = {
      presetId: settings.presetId || headshot1.defaultPresetId,
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
      aspectRatio: settings.aspectRatio || d.aspectRatio,
      focalLength: resolveFocalLength(settings.focalLength as string | undefined).id,
      aperture: resolveAperture(settings.aperture as string | undefined).id,
      lightingQuality: resolveLightingQuality(settings.lightingQuality as string | undefined).id,
      shutterSpeed: resolveShutterSpeed(settings.shutterSpeed as string | undefined).id,
      bodyAngle: resolveBodyAngle(settings.bodyAngle as string | undefined).id,
      headPosition: resolveHeadPosition(settings.headPosition as string | undefined).id,
      shoulderPosition: resolveShoulderPosition(settings.shoulderPosition as string | undefined).id,
      weightDistribution: resolveWeightDistribution(settings.weightDistribution as string | undefined).id,
      armPosition: resolveArmPosition(settings.armPosition as string | undefined).id,
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
      })(),
      subjectCount: settings.subjectCount ?? d.subjectCount,
      usageContext: settings.usageContext ?? d.usageContext
    }

    if (resolvedSittingPoseId) {
      resolved.sittingPose = resolvedSittingPoseId
    }

    return buildPrompt(resolved)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'headshot1',
      version: 1,
      presetId: ui.presetId ?? headshot1.defaultPresetId,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      clothingColors: ui.clothingColors || { type: 'user-choice' },
      shotType: ui.shotType,
      aspectRatio: ui.aspectRatio ?? headshot1.defaultSettings.aspectRatio,
      focalLength: ui.focalLength ?? headshot1.defaultSettings.focalLength,
      aperture: ui.aperture ?? headshot1.defaultSettings.aperture,
      lightingQuality: ui.lightingQuality ?? headshot1.defaultSettings.lightingQuality,
      shutterSpeed: ui.shutterSpeed ?? headshot1.defaultSettings.shutterSpeed,
      bodyAngle: ui.bodyAngle ?? headshot1.defaultSettings.bodyAngle,
      headPosition: ui.headPosition ?? headshot1.defaultSettings.headPosition,
      shoulderPosition: ui.shoulderPosition ?? headshot1.defaultSettings.shoulderPosition,
      weightDistribution: ui.weightDistribution ?? headshot1.defaultSettings.weightDistribution,
      armPosition: ui.armPosition ?? headshot1.defaultSettings.armPosition,
      sittingPose: ui.sittingPose ?? headshot1.defaultSettings.sittingPose,
      style: ui.style,
      expression: ui.expression,
      subjectCount: ui.subjectCount ?? headshot1.defaultSettings.subjectCount,
      usageContext: ui.usageContext ?? headshot1.defaultSettings.usageContext
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
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

      const rawClothingColors = r.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
      let clothingColors: PhotoStyleSettings['clothingColors']
      if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in r)) {
        clothingColors = { type: 'user-choice' }
      } else if (rawClothingColors.type === 'user-choice') {
        clothingColors = { type: 'user-choice' }
      } else if (!rawClothingColors.type) {
        clothingColors = {
          type: 'predefined',
          colors: rawClothingColors.colors
        }
      } else {
        clothingColors = rawClothingColors
      }

      const shotType: PhotoStyleSettings['shotType'] = (r.shotType as PhotoStyleSettings['shotType']) || headshot1.defaultSettings.shotType

      return {
        background: background || { type: 'user-choice' },
        branding,
        clothing: (r.clothing as PhotoStyleSettings['clothing']) || { style: 'user-choice' },
        clothingColors,
        shotType,
        presetId: (r.presetId as string) || headshot1.defaultPresetId,
        aspectRatio: (r.aspectRatio as string) || headshot1.defaultSettings.aspectRatio,
        focalLength: resolveFocalLength(r.focalLength as string | undefined).id,
        aperture: resolveAperture(r.aperture as string | undefined).id,
        lightingQuality: resolveLightingQuality(r.lightingQuality as string | undefined).id,
        shutterSpeed: resolveShutterSpeed(r.shutterSpeed as string | undefined).id,
        style: (r.style as PhotoStyleSettings['style']) || { type: 'preset', preset: 'corporate' },
        expression: (r.expression as PhotoStyleSettings['expression']) || { type: 'user-choice' },
        subjectCount:
          typeof r.subjectCount === 'string' &&
          ['1', '2-3', '4-8', '9+'].includes(r.subjectCount)
            ? (r.subjectCount as PhotoStyleSettings['subjectCount'])
            : headshot1.defaultSettings.subjectCount,
        usageContext:
          typeof r.usageContext === 'string' && ['general', 'social-media'].includes(r.usageContext)
            ? (r.usageContext as PhotoStyleSettings['usageContext'])
            : headshot1.defaultSettings.usageContext
      }
    }
  }
}

