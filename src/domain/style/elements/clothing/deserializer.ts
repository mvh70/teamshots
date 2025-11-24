import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes clothing settings from raw data
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults: PhotoStyleSettings['clothing']
): PhotoStyleSettings['clothing'] {
  const rawClothing = raw.clothing as PhotoStyleSettings['clothing'] | undefined
  
  if (!rawClothing) return defaults
  
  return rawClothing.style === 'user-choice'
    ? { style: 'user-choice' }
    : rawClothing
}

