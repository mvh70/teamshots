import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes shot type settings from raw data
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults: PhotoStyleSettings['shotType']
): PhotoStyleSettings['shotType'] {
  return (raw.shotType as PhotoStyleSettings['shotType']) || defaults
}

