import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes branding settings from raw data
 *
 * Supports both legacy logoKey and new logoAssetId fields.
 * If logoAssetId is provided, it takes precedence over logoKey.
 */
export function deserialize(raw: Record<string, unknown>): PhotoStyleSettings['branding'] {
  const rb = raw.branding as PhotoStyleSettings['branding'] | undefined

  const hasLogoKey = (b: unknown): b is { logoKey: string } =>
    typeof b === 'object' && b !== null && 'logoKey' in (b as Record<string, unknown>)

  const hasLogoAssetId = (b: unknown): b is { logoAssetId: string } =>
    typeof b === 'object' && b !== null && 'logoAssetId' in (b as Record<string, unknown>)

  let brandingType: 'include' | 'exclude' | 'user-choice' = 'user-choice'
  const t = (rb as unknown as { type?: 'include' | 'exclude' | 'user-choice' } | undefined)?.type

  if (t === 'include' || t === 'exclude' || t === 'user-choice') {
    brandingType = t
  } else if (hasLogoKey(rb) || hasLogoAssetId(rb)) {
    brandingType = 'include'
  }

  if (!rb) {
    return { type: 'user-choice', position: 'clothing' }
  }

  const result: PhotoStyleSettings['branding'] = {
    type: brandingType,
    logoKey: rb.logoKey,
    position: rb.position ?? 'clothing'
  }

  // Preserve logoAssetId if present
  if (hasLogoAssetId(rb)) {
    result.logoAssetId = rb.logoAssetId
  }

  // Preserve preparedLogoKey if present (optimization for regenerations)
  const hasPreparedLogoKey = (b: unknown): b is { preparedLogoKey: string } =>
    typeof b === 'object' && b !== null && 'preparedLogoKey' in (b as Record<string, unknown>)

  if (hasPreparedLogoKey(rb)) {
    (result as { preparedLogoKey?: string }).preparedLogoKey = rb.preparedLogoKey
  }

  return result
}

/**
 * Resolves logo assetId from branding settings
 * Returns logoAssetId if present, otherwise returns undefined (caller can use logoKey)
 */
export function getLogoAssetId(branding?: PhotoStyleSettings['branding']): string | undefined {
  if (!branding) return undefined
  return branding.logoAssetId
}

/**
 * Gets the effective logo key (prefers logoAssetId, falls back to logoKey)
 * Use this when you need an identifier for the logo image
 */
export function getLogoIdentifier(branding?: PhotoStyleSettings['branding']): string | undefined {
  if (!branding) return undefined
  return branding.logoAssetId ?? branding.logoKey
}

