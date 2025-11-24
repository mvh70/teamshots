import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes expression settings from raw data
 */
export function deserialize(
  raw: Record<string, unknown>,
  presetDefaults: PhotoStyleSettings['expression']
): PhotoStyleSettings['expression'] {
  const rawExpression = raw.expression as PhotoStyleSettings['expression'] | undefined
  return rawExpression ?? presetDefaults
}

