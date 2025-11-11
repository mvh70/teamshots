/**
 * Shared deserialization helper functions for style packages
 * 
 * These are OPTIONAL utilities that packages can use to deserialize common settings.
 * Each package should only deserialize settings that are exposed to users via visibleCategories.
 * 
 * Example:
 * - If a package only allows background and expression customization,
 *   it should only deserialize those two settings, not all 7.
 * - Use these helpers for convenience, but each package owns its serialization contract.
 */

import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Deserializes background settings from raw data
 */
export function deserializeBackground(raw: Record<string, unknown>): PhotoStyleSettings['background'] {
  const rawBg = raw.background as unknown
  
  if (rawBg && typeof rawBg === 'object') {
    return rawBg as PhotoStyleSettings['background']
  }
  
  type BgType = 'office' | 'neutral' | 'gradient' | 'custom' | 'user-choice' | 'tropical-beach' | 'busy-city'
  const allowed: readonly string[] = ['office', 'neutral', 'gradient', 'custom', 'user-choice', 'tropical-beach', 'busy-city']
  const bgType = (allowed.includes(rawBg as string) ? rawBg : 'user-choice') as BgType
  
  return { 
    type: bgType, 
    prompt: (raw['backgroundPrompt'] as string) || undefined 
  }
}

/**
 * Deserializes branding settings from raw data
 */
export function deserializeBranding(raw: Record<string, unknown>): PhotoStyleSettings['branding'] {
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
    ? { type: brandingType, logoKey: rb.logoKey, position: rb.position }
    : { type: 'user-choice' }
}

/**
 * Deserializes clothing settings from raw data
 */
export function deserializeClothing(
  raw: Record<string, unknown>,
  defaults: PhotoStyleSettings['clothing']
): PhotoStyleSettings['clothing'] {
  const rawClothing = raw.clothing as PhotoStyleSettings['clothing'] | undefined
  
  if (!rawClothing) return defaults
  
  return rawClothing.style === 'user-choice'
    ? { style: 'user-choice' }
    : rawClothing
}

/**
 * Deserializes clothing colors settings from raw data
 */
export function deserializeClothingColors(
  raw: Record<string, unknown>,
  defaults: { type: 'predefined'; colors: { topBase: string; topCover: string; bottom?: string; shoes?: string } }
): PhotoStyleSettings['clothingColors'] {
  const rawClothingColors = raw.clothingColors as PhotoStyleSettings['clothingColors'] | null | undefined
  
  if (rawClothingColors === null || rawClothingColors === undefined || !('clothingColors' in raw)) {
    return { type: 'user-choice' }
  }
  
  if (rawClothingColors.type === 'user-choice') {
    return { type: 'user-choice' }
  }
  
  return {
    type: 'predefined',
    colors: {
      topBase: rawClothingColors.colors?.topBase || defaults.colors.topBase,
      topCover: rawClothingColors.colors?.topCover || defaults.colors.topCover,
      bottom: rawClothingColors.colors?.bottom,
      shoes: rawClothingColors.colors?.shoes
    }
  }
}

/**
 * Deserializes shot type settings from raw data
 */
export function deserializeShotType(
  raw: Record<string, unknown>,
  defaults: PhotoStyleSettings['shotType']
): PhotoStyleSettings['shotType'] {
  return (raw.shotType as PhotoStyleSettings['shotType']) || defaults
}

/**
 * Deserializes expression settings from raw data
 */
export function deserializeExpression(
  raw: Record<string, unknown>,
  presetDefaults: PhotoStyleSettings['expression']
): PhotoStyleSettings['expression'] {
  const rawExpression = raw.expression as PhotoStyleSettings['expression'] | undefined
  return rawExpression ?? presetDefaults
}

