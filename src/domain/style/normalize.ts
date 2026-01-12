import {
  PhotoStyleSettings,
  DEFAULT_PHOTO_STYLE_SETTINGS,
  BackgroundSettings,
  BrandingSettings,
  StyleSettings,
  ExpressionSettings,
  LightingSettings,
  ClothingColorSettings,
  PoseSettings,
} from '@/types/photo-style'
import { hasValue } from './elements/base/element-types'

type LegacyContext = {
  id: string
  name: string
  settings?: Record<string, unknown>
  stylePreset?: StyleSettings['preset'] | null
  customPrompt?: string | null
}


export function normalizeContextToPhotoStyleSettings(context: LegacyContext): PhotoStyleSettings {
  const settings = (context.settings || {}) as {
    background?: Partial<BackgroundSettings>
    branding?: Partial<BrandingSettings>
    style?: Partial<StyleSettings>
    clothing?: PhotoStyleSettings['clothing']
    clothingColors?: Partial<ClothingColorSettings>
    expression?: Partial<ExpressionSettings>
    lighting?: Partial<LightingSettings>
    pose?: Partial<PoseSettings>
  }

  const stylePresetVal: StyleSettings['preset'] =
    (settings.style?.preset as StyleSettings['preset'] | undefined) || context.stylePreset || 'corporate'
  const style: StyleSettings = settings.style?.type
    ? { type: settings.style.type as StyleSettings['type'], preset: settings.style.preset as StyleSettings['preset'] | undefined }
    : { type: 'preset', preset: stylePresetVal }

  return {
    // Use settings directly if mode or type exists (preset), otherwise fall back to defaults
    // This preserves preset values and prevents them from being overwritten with user-choice defaults
    background: (settings.background as { mode?: string; type?: string })?.mode || (settings.background as { mode?: string; type?: string })?.type
      ? settings.background as BackgroundSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.background,
    // For branding, check if it has the ElementSetting pattern (mode property) or has a value
    branding: (settings.branding as { mode?: string })?.mode || hasValue(settings.branding as BrandingSettings)
      ? settings.branding as BrandingSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.branding,
    style,
    clothing: settings.clothing || DEFAULT_PHOTO_STYLE_SETTINGS.clothing,
    clothingColors: (settings.clothingColors as { mode?: string; type?: string })?.mode || (settings.clothingColors as { mode?: string; type?: string })?.type
      ? settings.clothingColors as ClothingColorSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.clothingColors,
    expression: (settings.expression as { mode?: string; type?: string })?.mode || (settings.expression as { mode?: string; type?: string })?.type
      ? settings.expression as ExpressionSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.expression,
    lighting: settings.lighting?.type 
      ? settings.lighting as LightingSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.lighting,
    pose: settings.pose?.mode
      ? settings.pose as PoseSettings
      : DEFAULT_PHOTO_STYLE_SETTINGS.pose,
  } as PhotoStyleSettings
}


