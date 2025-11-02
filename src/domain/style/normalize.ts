import {
  PhotoStyleSettings,
  DEFAULT_PHOTO_STYLE_SETTINGS,
  BackgroundSettings,
  BrandingSettings,
  StyleSettings,
} from '@/types/photo-style'

type LegacyContext = {
  id: string
  name: string
  settings?: Record<string, unknown>
  backgroundUrl?: string | null
  backgroundPrompt?: string | null
  logoUrl?: string | null
  stylePreset?: StyleSettings['preset'] | null
  customPrompt?: string | null
}

function extractKeyFromUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  try {
    const urlObj = new URL(url)
    if (urlObj.pathname === '/api/files/get') {
      return urlObj.searchParams.get('key') || undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

export function normalizeContextToPhotoStyleSettings(context: LegacyContext): PhotoStyleSettings {
  const settings = (context.settings || {}) as {
    background?: Partial<BackgroundSettings>
    branding?: Partial<BrandingSettings>
    style?: Partial<StyleSettings>
    clothing?: PhotoStyleSettings['clothing']
    expression?: PhotoStyleSettings['expression']
    lighting?: PhotoStyleSettings['lighting']
  }
  if (!settings) {
    return {
      ...DEFAULT_PHOTO_STYLE_SETTINGS,
      style: { type: 'preset', preset: context.stylePreset || 'corporate' }
    }
  }

  const bgKey = settings.background?.key || extractKeyFromUrl(context.backgroundUrl)
  const bgType = settings.background?.type || (context.backgroundUrl ? 'custom' : 'office')
  const bgPrompt = settings.background?.prompt || context.backgroundPrompt || undefined

  const brandingLogoKey = settings.branding?.logoKey || extractKeyFromUrl(context.logoUrl)
  const brandingType = settings.branding?.type || (context.logoUrl ? 'include' : 'exclude')

  const stylePresetVal: StyleSettings['preset'] =
    (settings.style?.preset as StyleSettings['preset'] | undefined) || context.stylePreset || 'corporate'
  const style: StyleSettings = settings.style?.type
    ? { type: settings.style.type as StyleSettings['type'], preset: settings.style.preset as StyleSettings['preset'] | undefined }
    : { type: 'preset', preset: stylePresetVal }

  return {
    background: { ...DEFAULT_PHOTO_STYLE_SETTINGS.background, ...settings.background, key: bgKey, type: bgType as BackgroundSettings['type'], prompt: bgPrompt },
    branding: { ...DEFAULT_PHOTO_STYLE_SETTINGS.branding, ...settings.branding, logoKey: brandingLogoKey, type: brandingType as BrandingSettings['type'] },
    style,
    clothing: settings.clothing || DEFAULT_PHOTO_STYLE_SETTINGS.clothing,
    expression: settings.expression || DEFAULT_PHOTO_STYLE_SETTINGS.expression,
    lighting: settings.lighting || DEFAULT_PHOTO_STYLE_SETTINGS.lighting,
  } as PhotoStyleSettings
}


