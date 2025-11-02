import { CategoryType, DEFAULT_PHOTO_STYLE_SETTINGS, PhotoStyleSettings } from '@/types/photo-style'

export type PackageId = 'headshot1'

export interface PackageDefinition {
  id: PackageId
  label: string
  version: number
  visibleCategories: CategoryType[]
  defaultSettings: PhotoStyleSettings
  promptBuilder: (settings: PhotoStyleSettings) => string
  persistenceAdapter: {
    serialize: (ui: PhotoStyleSettings) => Record<string, unknown>
    deserialize: (raw: Record<string, unknown>) => PhotoStyleSettings
  }
}

const BASE_CATEGORIES: CategoryType[] = [
  'background',
  'branding',
  'clothing',
  'style',
  'expression',
  'lighting'
]

export const PACKAGES: Record<PackageId, PackageDefinition> = {
  headshot1: {
    id: 'headshot1',
    label: 'HeadShot1',
    version: 1,
    visibleCategories: BASE_CATEGORIES,
    defaultSettings: DEFAULT_PHOTO_STYLE_SETTINGS,
    promptBuilder: (s) => {
      type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice'
      const isBg = (v: unknown): v is BgType => ['office','neutral','gradient','custom','user-choice'].includes(v as string)
      const bg: BgType = isBg(s.background?.type) ? s.background!.type : 'user-choice'
      const logo = s.branding?.type === 'include' ? 'with logo' : 'without logo'
      const style = s.style?.preset ?? 'corporate'
      return `Professional headshot, style ${style}, background ${bg}, ${logo}`
    },
    persistenceAdapter: {
      serialize: (ui) => ({
        packageId: 'headshot1',
        version: 1,
        // Persist the full background object so selected images/colors are not lost
        background: ui.background,
        branding: ui.branding,
        clothing: ui.clothing,
        style: ui.style,
        expression: ui.expression,
        lighting: ui.lighting
      }),
      deserialize: (raw) => {
        // Accept both old (type/prompt split) and new (full object) formats
        const rawBg = raw.background as unknown
        let background: PhotoStyleSettings['background']
        if (rawBg && typeof rawBg === 'object') {
          background = rawBg as PhotoStyleSettings['background']
        } else {
          type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice'
          const allowed: readonly string[] = ['office','neutral','gradient','custom','user-choice']
          const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
          background = { type: bgType, prompt: (raw as Record<string, unknown>)['backgroundPrompt'] as string | undefined }
        }
        const rawBranding = (raw.branding as unknown) as PhotoStyleSettings['branding'] | undefined
        const branding: PhotoStyleSettings['branding'] = rawBranding
          ? {
              type: (rawBranding.type as 'include' | 'exclude' | 'user-choice' | undefined)
                ?? (rawBranding.logoKey ? 'include' : 'user-choice'),
              logoKey: rawBranding.logoKey,
              position: rawBranding.position
            }
          : { type: 'user-choice' }

        return {
          background: background ?? { type: 'user-choice' },
          branding,
          clothing: (raw.clothing as unknown as PhotoStyleSettings['clothing']) ?? { style: 'user-choice' },
          style: (raw.style as unknown as PhotoStyleSettings['style']) ?? { type: 'preset', preset: 'corporate' },
          expression: (raw.expression as unknown as PhotoStyleSettings['expression']) ?? { type: 'user-choice' },
          lighting: (raw.lighting as unknown as PhotoStyleSettings['lighting']) ?? { type: 'user-choice' }
        }
      }
    }
  }
}

export function getPackageConfig(id?: string): PackageDefinition {
  if (!id) return PACKAGES.headshot1
  return PACKAGES[(id as PackageId)] || PACKAGES.headshot1
}
