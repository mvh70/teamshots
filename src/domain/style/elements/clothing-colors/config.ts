import { normalizeColorToHex, COMMON_COLOR_MAPPINGS } from '@/lib/color-utils'
import type { ElementConfig } from '../registry'
import { predefined, userChoice, hasValue } from '../base/element-types'
import { deserialize } from './deserializer'
import type { ClothingColorSettings, ClothingColorValue, ColorValue } from './types'
export type { ClothingColorSettings, ClothingColorValue, ClothingColorKey, ColorValue } from './types'

export { normalizeColorToHex, COMMON_COLOR_MAPPINGS }

function isColorObject(value: unknown): value is ColorValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { hex?: unknown }).hex === 'string' &&
    (
      (value as { name?: unknown }).name === undefined ||
      typeof (value as { name?: unknown }).name === 'string'
    )
  )
}

function sanitizeSavedColors(savedValue: unknown): ClothingColorSettings | undefined {
  if (typeof savedValue !== 'object' || savedValue === null) return undefined

  const raw = savedValue as Record<string, unknown>
  const value: ClothingColorValue = {}

  for (const key of ['topLayer', 'baseLayer', 'bottom', 'shoes'] as const) {
    const candidate = raw[key]
    if (typeof candidate === 'string' || isColorObject(candidate)) {
      value[key] = candidate
    }
  }

  if (raw.source === 'manual' || raw.source === 'outfit') {
    value.source = raw.source
  }

  if (Object.keys(value).length === 0) return undefined
  return predefined(value)
}

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
  deserialize,
  mergePredefinedFromSession: ({ savedValue }) => sanitizeSavedColors(savedValue),
}
