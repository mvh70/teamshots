import { PhotoStyleSettings } from '@/types/photo-style'
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

const FREE_PRESET_ID = 'corporate-headshot' as const
const FREE_PRESET_DEFAULTS = getDefaultPresetSettings(FREE_PRESET_ID)

const DEFAULTS = {
  ...FREE_PRESET_DEFAULTS,
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
  expression: { type: 'happy' as const },
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

function getValueOrDefault<T>(value: T | undefined | { type?: string }, defaultValue: T): T {
  if (!value) return defaultValue
  return value as T
}

function buildPrompt(settings: PhotoStyleSettings): string {
  const { preset, settings: effectiveSettings } = applyStandardPreset(
    settings.presetId || freepackage.defaultPresetId,
    settings
  )
  const presetDefaults = getDefaultPresetSettings(preset.id)

  const overrides: Record<string, unknown> = {}
  const payload: NestedRecord = {
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
        sitting_position: undefined,
        expression: getExpressionLabel(presetDefaults.expression?.type)
      },
      wardrobe: {},
      branding: {}
    },
    framing: {
      shot_type: '',
      crop_points: '',
      orientation: 'vertical',
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
      texture: 'retain fabric weave and hair detail and facial features like wrinkles, freckles, moles, etc.',
      cleanliness: 'no text, labels, borders, or UI artifacts',
      framing: 'the original selfies of the subject should not be shown in the final image',
      quality: 'high resolution, print-ready'
    }
  }

  setPath(payload, 'subject.identity.reference_roles', [
    {
      reference: 'subject1-selfie2',
      label: 'Reference – Main Likeness',
      instructions: [
        'From all provided selfies, choose the shot that best matches the requested pose and lighting as the primary likeness. Use the remaining selfies only to reinforce 3D structure and facial detail, and do not display the raw selfies in the final image.'
      ]
    },
    { reference: 'subject1-selfie4', label: 'Reference – Supporting Angle', instructions: [] },
    { reference: 'subject1-selfie3', label: 'Reference – Supporting Angle', instructions: [] },
    { reference: 'subject1-selfie5', label: 'Reference – Supporting Expression', instructions: [] },
    { reference: 'subject1-selfie1', label: 'Reference – Supporting Frontal', instructions: [] }
  ])

  setPath(payload, 'subject.identity.glasses_guidance', {
    reflections: 'Study subject1-selfie2 and subject1-selfie3 for realistic lens reflections. Maintain visibility of the eyes while reproducing believable light behaviour on the glasses.'
  })

  setPath(payload, 'subject.identity.identity_guidelines', [
    'All generated results must clearly depict the same individual from the provided selfies.',
    'Prioritize natural, photorealistic rendering quality matching the supplied source imagery.',
    'Integrate expression and lighting cues from supporting references without deviating from the core identity.'
  ])

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
  const lightingConfig = resolveLightingQuality(effectiveSettings.lightingQuality as string | undefined)
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
  setPath(payload, 'subject.pose.sitting_position', presetSittingConfig?.description)
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
  setPath(payload, 'camera.settings.iso', preset.defaults.iso ?? 100)
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
  setPath(payload, 'subject.pose.arms', 'opening jacket to reveal logo on base shirt')
  setPath(payload, 'subject.pose.sitting_position', activeSittingConfig?.description)
  setPath(payload, 'subject.pose.expression', getExpressionLabel(effectiveSettings.expression?.type))
  setPath(payload, 'subject.pose.description', 'Subject is elegantly opening the jacket to proudly reveal the logo on the base garment beneath.')

  const clothing = effectiveSettings.clothing
  const clothingStyle = clothing?.style || DEFAULTS.clothing.style
  const clothingColors = effectiveSettings.clothingColors
  const wardrobe: Record<string, unknown> = {
    style: clothingStyle,
    outer_layer: 'blazer or jacket (partially open)',
    base_layer: 'elegant t-shirt with brand logo',
    notes: 'no tie, logo visible on base shirt'
  }
  if (clothing?.accessories && Array.isArray(clothing.accessories) && clothing.accessories.length > 0) {
    wardrobe.accessories = clothing.accessories
  }
  if (clothingColors && clothingColors.type === 'predefined' && clothingColors.colors) {
    const palette: Record<string, string> = {}
    if (clothingColors.colors.topBase) palette.top_base = clothingColors.colors.topBase
    if (clothingColors.colors.topCover) palette.top_cover = clothingColors.colors.topCover
    if (clothingColors.colors.bottom) palette.bottom = clothingColors.colors.bottom
    if (clothingColors.colors.shoes) palette.shoes = clothingColors.colors.shoes
    if (Object.keys(palette).length > 0) {
      wardrobe.color_palette = palette
    }
  }
  setPath(payload, 'subject.wardrobe', wardrobe)

  const branding = effectiveSettings.branding
  if (branding?.type === 'include' && branding.logoKey) {
    setPath(payload, 'subject.branding', {
      logo_source: 'attached brand image',
      placement: 'centrally on the base shirt, on the chest area',
      size: 'modest, proportional to garment',
      rules: [
        'Base shirt only - not on jacket',
        'No duplication or patterns',
        'Maintain original aspect ratio and colors',
        'No stylization or warping'
      ]
    })
  } else {
    setPath(payload, 'subject.branding', {
      rules: ['no brand marks visible']
    })
  }

  const defaultEnvironmentLocation = preset.defaults.environment.description
  let environmentLocation = defaultEnvironmentLocation
  let environmentDistance = presetBackgroundDistanceFt
  let lightingContext = 'soft diffused studio lighting with reflector fill'
  let isoValue = preset.defaults.iso ?? 100
  let lightingSetup = preset.defaults.lighting.setupNotes ?? ['Softbox (3x4ft or larger) + reflector opposite']
  let lightingFill: string | undefined
  let whiteBalance = '5500K'

  const background = effectiveSettings.background
  if (background) {
    const bgPrompt = generateBackgroundPrompt(background)
    if (bgPrompt.location_type) {
      environmentLocation = bgPrompt.location_type
    }
    if (bgPrompt.description) {
      setPath(payload, 'scene.environment.description', bgPrompt.description)
    }
    if (bgPrompt.color_palette) {
      setPath(payload, 'scene.environment.color_palette', bgPrompt.color_palette)
    }
    if (bgPrompt.branding) {
      setPath(payload, 'scene.environment.branding', bgPrompt.branding)
    }
  }

  if (
    background?.type === 'tropical-beach' ||
    (typeof background?.prompt === 'string' && background.prompt.toLowerCase().includes('tropical'))
  ) {
    environmentDistance = 8
    lightingContext = 'natural golden hour light mimicking studio quality'
    isoValue = 200
    lightingSetup = ['natural golden hour mimicking studio softbox']
    lightingFill = 'natural reflector (sand/water)'
    whiteBalance = '5500K'
  }

  applyOverride('environment', 'scene.environment.location_type', environmentLocation, defaultEnvironmentLocation)
  setPath(payload, 'scene.environment.lighting_context', lightingContext)

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

  if (lightingFill) {
    setPath(payload, 'lighting.fill', lightingFill)
  }
  setPath(payload, 'lighting.setup', lightingSetup)
  setPath(payload, 'lighting.color_temperature', whiteBalance)
  setPath(payload, 'lighting.description', 'flattering with gentle transitions, minimal harsh shadows')
  setPath(payload, 'lighting.quality', lightingConfig.label)
  setPath(payload, 'lighting.direction', getLightingDirectionLabel(preset.defaults.lighting.direction))

  setPath(payload, 'camera.settings.iso', isoValue)
  setPath(payload, 'camera.settings.white_balance', whiteBalance)

  setPath(payload, 'framing.composition', 'centered')
  setPath(payload, 'framing.aspect_ratio', preset.defaults.aspectRatio)

  return JSON.stringify(payload, null, 2)
}

export const freepackage: ClientStylePackage = {
  id: 'freepackage',
  label: 'Free Package',
  version: 1,
  visibleCategories: ['background', 'branding', 'clothing', 'clothingColors', 'shotType', 'aspectRatio', 'focalLength', 'aperture', 'lightingQuality', 'shutterSpeed', 'bodyAngle', 'headPosition', 'shoulderPosition', 'weightDistribution', 'armPosition', 'sittingPose', 'expression'],
  availableBackgrounds: ['office', 'tropical-beach', 'busy-city', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  defaultPresetId: FREE_PRESET_ID,
  promptBuilder: (settings, _ctx) => {
    void _ctx
  const resolvedSittingPose =
    settings.sittingPose && settings.sittingPose !== 'user-choice'
      ? resolveSittingPose(settings.sittingPose as string | undefined).id
      : undefined

  const resolvedSettingsBase: PhotoStyleSettings = {
      presetId: settings.presetId || freepackage.defaultPresetId,
      background: getValueOrDefault(settings.background, DEFAULTS.background),
      branding: getValueOrDefault(settings.branding, DEFAULTS.branding),
      clothing: getValueOrDefault(settings.clothing, DEFAULTS.clothing),
      clothingColors: getValueOrDefault(settings.clothingColors, DEFAULTS.clothingColors),
      shotType: getValueOrDefault(settings.shotType, DEFAULTS.shotType),
      aspectRatio: settings.aspectRatio || DEFAULTS.aspectRatio,
      focalLength: resolveFocalLength(settings.focalLength as string | undefined).id,
      aperture: resolveAperture(settings.aperture as string | undefined).id,
      lightingQuality: resolveLightingQuality(settings.lightingQuality as string | undefined).id,
      shutterSpeed: resolveShutterSpeed(settings.shutterSpeed as string | undefined).id,
      bodyAngle: resolveBodyAngle(settings.bodyAngle as string | undefined).id,
      headPosition: resolveHeadPosition(settings.headPosition as string | undefined).id,
      shoulderPosition: resolveShoulderPosition(settings.shoulderPosition as string | undefined).id,
      weightDistribution: resolveWeightDistribution(settings.weightDistribution as string | undefined).id,
    armPosition: resolveArmPosition(settings.armPosition as string | undefined).id,
      expression: getValueOrDefault(settings.expression, DEFAULTS.expression),
      subjectCount: settings.subjectCount ?? DEFAULTS.subjectCount,
      usageContext: settings.usageContext ?? DEFAULTS.usageContext
    }

  const resolvedSettings: PhotoStyleSettings = resolvedSittingPose
    ? { ...resolvedSettingsBase, sittingPose: resolvedSittingPose }
    : { ...resolvedSettingsBase }
    return buildPrompt(resolvedSettings)
  },
  persistenceAdapter: {
    serialize: (ui) => ({
      packageId: 'freepackage',
      version: 1,
      presetId: ui.presetId ?? freepackage.defaultPresetId,
      background: ui.background,
      branding: ui.branding,
      clothing: ui.clothing,
      clothingColors: ui.clothingColors || { type: 'user-choice' },
      shotType: ui.shotType,
      aspectRatio: ui.aspectRatio ?? DEFAULTS.aspectRatio,
      focalLength: ui.focalLength ?? DEFAULTS.focalLength,
      aperture: ui.aperture ?? DEFAULTS.aperture,
      lightingQuality: ui.lightingQuality ?? DEFAULTS.lightingQuality,
      shutterSpeed: ui.shutterSpeed ?? DEFAULTS.shutterSpeed,
      bodyAngle: ui.bodyAngle ?? DEFAULTS.bodyAngle,
      headPosition: ui.headPosition ?? DEFAULTS.headPosition,
      shoulderPosition: ui.shoulderPosition ?? DEFAULTS.shoulderPosition,
      weightDistribution: ui.weightDistribution ?? DEFAULTS.weightDistribution,
      armPosition: ui.armPosition ?? DEFAULTS.armPosition,
      sittingPose: ui.sittingPose ?? DEFAULTS.sittingPose,
      expression: ui.expression,
      subjectCount: ui.subjectCount ?? DEFAULTS.subjectCount,
      usageContext: ui.usageContext ?? DEFAULTS.usageContext
    }),
    deserialize: (raw) => {
      const r = raw as Record<string, unknown>
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

      const rawClothing = r.clothing as PhotoStyleSettings['clothing'] | undefined
      const clothing: PhotoStyleSettings['clothing'] = rawClothing
        ? rawClothing.style === 'user-choice'
          ? { style: 'user-choice' }
          : rawClothing
        : DEFAULTS.clothing

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

      const shotType: PhotoStyleSettings['shotType'] =
        (r.shotType as PhotoStyleSettings['shotType']) || DEFAULTS.shotType

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
        presetId: (r.presetId as string) || freepackage.defaultPresetId,
        aspectRatio: (r.aspectRatio as string) || DEFAULTS.aspectRatio,
        focalLength: resolveFocalLength(r.focalLength as string | undefined).id,
        aperture: resolveAperture(r.aperture as string | undefined).id,
        lightingQuality: resolveLightingQuality(r.lightingQuality as string | undefined).id,
        shutterSpeed: resolveShutterSpeed(r.shutterSpeed as string | undefined).id,
        expression,
        subjectCount:
          typeof r.subjectCount === 'string' &&
          ['1', '2-3', '4-8', '9+'].includes(r.subjectCount)
            ? (r.subjectCount as PhotoStyleSettings['subjectCount'])
            : DEFAULTS.subjectCount,
        usageContext:
          typeof r.usageContext === 'string' && ['general', 'social-media'].includes(r.usageContext)
            ? (r.usageContext as PhotoStyleSettings['usageContext'])
            : DEFAULTS.usageContext
      }
    }
  }
}
