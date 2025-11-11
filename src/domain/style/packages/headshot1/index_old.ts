import { PhotoStyleSettings } from '@/types/photo-style'
import type { ClientStylePackage } from '../index'
import {
  buildStandardPrompt,
  generateBackgroundPrompt,
  generateBrandingPrompt,
  generateExpressionPrompt,
  generateWardrobePrompt
} from '../../prompt-builders'
import {
  resolveSittingPose
} from '../pose-presets'
import { getDefaultPresetSettings } from '../standard-settings'
const FREE_PRESET_ID = 'corporate-headshot' as const

const HEADSHOT_PRESET_DEFAULTS = getDefaultPresetSettings(FREE_PRESET_ID)

const DEFAULTS = {
  ...HEADSHOT_PRESET_DEFAULTS,
  background: { type: 'neutral' as const, color: '#f2f2f2' },
  branding: { type: 'exclude' as const },
  clothing: { style: 'business' as const, details: 'formal' },
  clothingColors: {
    type: 'predefined' as const,
    colors: { 
      topBase: 'White',
      topCover: 'Dark blue',
      shoes: 'white',
      bottom: 'Gray'
    }
  },
  style: { type: 'preset' as const, preset: 'corporate' as const },
  expression: { type: 'professional' as const }
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

function buildPrompt(settings: PhotoStyleSettings): string {
  const {
    presetDefaults,
    effectiveSettings,
    payload
  } = buildStandardPrompt({
    settings,
    defaultPresetId: headshot1.defaultPresetId,
    presetDefaults: HEADSHOT_PRESET_DEFAULTS
  })

  const expressionResult = generateExpressionPrompt(effectiveSettings.expression)
  const currentArmPose = (payload.subject as Record<string, unknown>)?.pose as Record<string, unknown> | undefined
  const armsPose = currentArmPose?.arms as string
  const defaultPose = {
    arms: armsPose,
    description: expressionResult.poseDescription
  }
  setPath(payload, 'subject.pose.expression', expressionResult.expression)
  setPath(payload, 'subject.pose.description', defaultPose.description)
  setPath(payload, 'subject.pose.arms', defaultPose.arms)

  const background = effectiveSettings.background
  if (background) {
    const bgPrompt = generateBackgroundPrompt(background)
    if (bgPrompt.location_type) {
      setPath(payload, 'scene.environment.location_type', bgPrompt.location_type)
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

  const wardrobeResult = generateWardrobePrompt({
    clothing: effectiveSettings.clothing ?? DEFAULTS.clothing,
    clothingColors: effectiveSettings.clothingColors ?? DEFAULTS.clothingColors,
    shotType: effectiveSettings.shotType?.type ?? presetDefaults.shotType?.type
  })
  setPath(payload, 'subject.wardrobe', wardrobeResult.wardrobe)

  const brandingResult = generateBrandingPrompt({
    branding: effectiveSettings.branding,
    styleKey: wardrobeResult.styleKey,
    detailKey: wardrobeResult.detailKey,
    defaultPose
  })
  setPath(payload, 'subject.branding', brandingResult.branding)
  setPath(payload, 'subject.pose.arms', brandingResult.pose.arms)
  setPath(payload, 'subject.pose.description', brandingResult.pose.description)

  return JSON.stringify(payload, null, 2)
}

export const headshot1: ClientStylePackage = {
  id: 'headshot1',
  label: 'HeadShot1',
  version: 1,
  visibleCategories: ['background','branding','clothing','clothingColors','shotType','aspectRatio','style','expression'],
  availableBackgrounds: ['office', 'neutral', 'gradient', 'custom'],
  defaultSettings: DEFAULTS,
  defaultPresetId: FREE_PRESET_ID,
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
      aspectRatio: settings.aspectRatio,
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
      subjectCount: settings.subjectCount ?? '1',
      usageContext: settings.usageContext ?? 'general'
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
      style: ui.style,
      expression: ui.expression,
      subjectCount: ui.subjectCount ?? '1',
      usageContext: ui.usageContext ?? 'general'
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
        focalLength: HEADSHOT_PRESET_DEFAULTS.focalLength,
        aperture: HEADSHOT_PRESET_DEFAULTS.aperture,
        lightingQuality: HEADSHOT_PRESET_DEFAULTS.lightingQuality,
        shutterSpeed: HEADSHOT_PRESET_DEFAULTS.shutterSpeed,
        style: (r.style as PhotoStyleSettings['style']) || { type: 'preset', preset: 'corporate' },
        expression:
          (r.expression as PhotoStyleSettings['expression']) ??
          headshot1.defaultSettings.expression,
        subjectCount:
          typeof r.subjectCount === 'string' &&
          ['1', '2-3', '4-8', '9+'].includes(r.subjectCount)
            ? (r.subjectCount as PhotoStyleSettings['subjectCount'])
            : '1',
        usageContext:
          typeof r.usageContext === 'string' && ['general', 'social-media'].includes(r.usageContext)
            ? (r.usageContext as PhotoStyleSettings['usageContext'])
            : 'general'
      }
    }
  }
}

