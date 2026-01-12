import type { BrandingSettings, BrandingValue, LegacyBrandingSettings, BrandingType } from './types'
import { predefined, userChoice, hasValue } from '../base/element-types'

/**
 * Deserializes branding settings from raw data
 *
 * Supports both legacy format and new mode/value format.
 * Also handles legacy logoKey and new logoAssetId fields.
 */
export function deserialize(raw: Record<string, unknown>): BrandingSettings {
  const rb = raw.branding as Record<string, unknown> | undefined

  const hasLogoKey = (b: unknown): b is { logoKey: string } =>
    typeof b === 'object' && b !== null && 'logoKey' in (b as Record<string, unknown>)

  const hasLogoAssetId = (b: unknown): b is { logoAssetId: string } =>
    typeof b === 'object' && b !== null && 'logoAssetId' in (b as Record<string, unknown>)

  const hasPreparedLogoKey = (b: unknown): b is { preparedLogoKey: string } =>
    typeof b === 'object' && b !== null && 'preparedLogoKey' in (b as Record<string, unknown>)

  if (!rb) {
    return userChoice()
  }

  // Detect new format (has 'mode' field)
  if ('mode' in rb && typeof rb.mode === 'string') {
    const mode = rb.mode as 'predefined' | 'user-choice'
    const value = rb.value as BrandingValue | undefined
    return { mode, value }
  }

  // Legacy format detection
  const legacy = rb as unknown as LegacyBrandingSettings

  if (legacy.type === 'user-choice') {
    // User-choice with partial value (may have logo configured but type not selected)
    if (hasLogoKey(legacy) || hasLogoAssetId(legacy)) {
      const value: BrandingValue = {
        type: 'include', // Default to include if logo is present
        logoKey: legacy.logoKey,
        logoAssetId: legacy.logoAssetId,
        position: legacy.position ?? 'clothing'
      }
      if (hasPreparedLogoKey(legacy)) {
        value.preparedLogoKey = legacy.preparedLogoKey
      }
      return userChoice(value)
    }
    return userChoice()
  }

  // Has include or exclude type
  if (legacy.type === 'include' || legacy.type === 'exclude') {
    const value: BrandingValue = {
      type: legacy.type,
      logoKey: legacy.logoKey,
      logoAssetId: legacy.logoAssetId,
      position: legacy.position ?? 'clothing'
    }
    if (hasPreparedLogoKey(legacy)) {
      value.preparedLogoKey = legacy.preparedLogoKey
    }
    return predefined(value)
  }

  // Fallback - infer from logo presence
  if (hasLogoKey(legacy) || hasLogoAssetId(legacy)) {
    const value: BrandingValue = {
      type: 'include',
      logoKey: legacy.logoKey,
      logoAssetId: legacy.logoAssetId,
      position: legacy.position ?? 'clothing'
    }
    if (hasPreparedLogoKey(legacy)) {
      value.preparedLogoKey = legacy.preparedLogoKey
    }
    return predefined(value)
  }

  return userChoice()
}

/**
 * Resolves logo assetId from branding settings
 * Returns logoAssetId if present, otherwise returns undefined (caller can use logoKey)
 */
export function getLogoAssetId(branding?: BrandingSettings): string | undefined {
  if (!branding || !hasValue(branding)) return undefined
  return branding.value.logoAssetId
}

/**
 * Gets the effective logo key (prefers logoAssetId, falls back to logoKey)
 * Use this when you need an identifier for the logo image
 */
export function getLogoIdentifier(branding?: BrandingSettings): string | undefined {
  if (!branding || !hasValue(branding)) return undefined
  return branding.value.logoAssetId ?? branding.value.logoKey
}

