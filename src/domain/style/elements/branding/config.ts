import type { BrandingSettings, BrandingType, BrandingValue } from './types'
import type { ElementConfig } from '../registry'
import { deserialize } from './deserializer'
import { predefined, userChoice, hasValue } from '../base/element-types'

export { BrandingSettings, BrandingType, BrandingValue }

export interface BrandingTypeConfig {
  value: BrandingType
  icon: string
  color: string
}

/**
 * Branding type options
 * Labels come from i18n: branding.include, branding.exclude
 */
export const BRANDING_TYPES: BrandingTypeConfig[] = [
  { value: 'include', icon: '✨', color: 'from-blue-500 to-indigo-500' },
  { value: 'exclude', icon: '🚫', color: 'from-gray-400 to-gray-500' }
]

/**
 * Branding position options
 * Labels come from i18n: branding.position.background, branding.position.clothing, branding.position.elements
 */
export const BRANDING_POSITIONS = [
  { key: 'background' },
  { key: 'clothing' },
  { key: 'elements' }
] as const

/**
 * Element registry config for branding
 */
export const brandingElementConfig: ElementConfig<BrandingSettings> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults && hasValue(packageDefaults)) {
      return predefined({ ...packageDefaults.value })
    }
    return predefined({ type: 'include', position: 'clothing' })
  },
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
