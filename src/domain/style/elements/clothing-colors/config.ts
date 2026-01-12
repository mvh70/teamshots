import { normalizeColorToHex, COMMON_COLOR_MAPPINGS } from '@/lib/color-utils'
import type { ElementConfig } from '../registry'
import { predefined, userChoice, hasValue } from '../base/element-types'
import { deserialize } from './deserializer'
import type { ClothingColorSettings } from './types'
export type { ClothingColorSettings, ClothingColorValue, ClothingColorKey, ColorValue } from './types'

export { normalizeColorToHex, COMMON_COLOR_MAPPINGS }

/**
 * Element registry config for clothing colors
 */
export const clothingColorsElementConfig: ElementConfig<ClothingColorSettings> = {
  getDefaultPredefined: (packageDefaults) => {
    if (packageDefaults && hasValue(packageDefaults)) {
      return predefined({ ...packageDefaults.value })
    }
    return predefined({ topLayer: 'navy', baseLayer: 'white', bottom: 'gray' })
  },
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
