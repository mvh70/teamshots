import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes branding settings from raw data
 */
export function deserialize(raw: Record<string, unknown>): PhotoStyleSettings['branding'] {
  const rb = raw.branding as PhotoStyleSettings['branding'] | undefined
  
  const hasLogoKey = (b: unknown): b is { logoKey: string } =>
    typeof b === 'object' && b !== null && 'logoKey' in (b as Record<string, unknown>)

  let brandingType: 'include' | 'exclude' | 'user-choice' = 'user-choice'
  const t = (rb as unknown as { type?: 'include' | 'exclude' | 'user-choice' } | undefined)?.type
  
  if (t === 'include' || t === 'exclude' || t === 'user-choice') {
    brandingType = t
  } else if (hasLogoKey(rb)) {
    brandingType = 'include'
  }
  
  return rb
    ? { type: brandingType, logoKey: rb.logoKey, position: rb.position ?? 'clothing' }
    : { type: 'user-choice', position: 'clothing' }
}

