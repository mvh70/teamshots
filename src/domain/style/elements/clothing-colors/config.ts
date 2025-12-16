import { normalizeColorToHex, COMMON_COLOR_MAPPINGS } from '@/lib/color-utils'
import type { ElementConfig } from '../registry'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { deserialize } from './deserializer'

export { normalizeColorToHex, COMMON_COLOR_MAPPINGS }

/**
 * Element registry config for clothing colors
 */
export const clothingColorsElementConfig: ElementConfig<PhotoStyleSettings['clothingColors']> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults?.colors) {
      return {
        type: 'predefined',
        colors: { ...packageDefaults.colors }
      }
    }
    return {
      type: 'predefined',
      colors: { topCover: 'navy', topBase: 'white', bottom: 'gray' }
    }
  },
  getDefaultUserChoice: () => ({ type: 'user-choice' }),
  deserialize
}
