import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes pose settings from raw data
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults: PhotoStyleSettings['pose']
): PhotoStyleSettings['pose'] {
  return (raw.pose as PhotoStyleSettings['pose']) || defaults
}

