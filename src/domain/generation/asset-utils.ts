/**
 * Asset Utilities
 *
 * Centralized utilities for loading and processing generation assets
 * (logos, backgrounds, etc.)
 */

import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ReferenceImage, DownloadAssetFn } from '@/types/generation'
import { hasValue } from '@/domain/style/elements/base/element-types'

/**
 * Loads logo reference if branding is configured
 * 
 * @param styleSettings - Photo style settings containing branding config
 * @param downloadAsset - Function to download assets from S3
 * @returns Logo reference or undefined if not configured/failed
 * 
 * @example
 * ```typescript
 * const logoRef = await loadLogoReference(
 *   styleSettings,
 *   (key) => downloadAssetAsBase64({ key, ... })
 * )
 * if (logoRef) {
 *   // Use logo in generation
 * }
 * ```
 */
export async function loadLogoReference(
  styleSettings: PhotoStyleSettings,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage | undefined> {
  // Check if branding has a value
  if (!styleSettings.branding || !hasValue(styleSettings.branding)) {
    return undefined
  }

  const brandingValue = styleSettings.branding.value

  // Check if logo should be included
  if (brandingValue.type !== 'include') {
    return undefined
  }

  // Check if logo key is provided
  if (!brandingValue.logoKey) {
    Logger.debug('Logo branding enabled but no logoKey provided')
    return undefined
  }

  try {
    const logoAsset = await downloadAsset(brandingValue.logoKey)

    if (!logoAsset) {
      Logger.warn('Logo asset download returned null', {
        logoKey: brandingValue.logoKey
      })
      return undefined
    }

    return {
      description: 'Company logo',
      base64: logoAsset.base64,
      mimeType: logoAsset.mimeType
    }
  } catch (error) {
    Logger.warn('Failed to load logo reference', {
      error: error instanceof Error ? error.message : String(error),
      logoKey: brandingValue.logoKey
    })
    return undefined
  }
}

/**
 * Loads logo reference specifically for clothing placement
 * Only returns logo if position is set to 'clothing'
 *
 * @param styleSettings - Photo style settings
 * @param downloadAsset - Asset download function
 * @returns Logo reference or undefined
 */
export async function loadClothingLogoReference(
  styleSettings: PhotoStyleSettings,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage | undefined> {
  // Only load if branding has value and position is clothing
  if (!styleSettings.branding || !hasValue(styleSettings.branding)) {
    return undefined
  }

  if (styleSettings.branding.value.position !== 'clothing') {
    return undefined
  }

  return loadLogoReference(styleSettings, downloadAsset)
}

/**
 * Loads background reference if custom background is configured
 * 
 * @param styleSettings - Photo style settings
 * @param downloadAsset - Asset download function
 * @returns Background reference or undefined
 */
export async function loadBackgroundReference(
  styleSettings: PhotoStyleSettings,
  downloadAsset: DownloadAssetFn
): Promise<ReferenceImage | undefined> {
  // Check if custom background is configured (uses 'key' not 'imageKey')
  const bgValue = styleSettings.background?.value
  if (bgValue?.type !== 'custom' || !bgValue.key) {
    return undefined
  }

  try {
    const backgroundAsset = await downloadAsset(bgValue.key)

    if (!backgroundAsset) {
      Logger.warn('Background asset download returned null', {
        key: bgValue.key
      })
      return undefined
    }

    return {
      description: 'Custom background',
      base64: backgroundAsset.base64,
      mimeType: backgroundAsset.mimeType
    }
  } catch (error) {
    Logger.warn('Failed to load background reference', {
      error: error instanceof Error ? error.message : String(error),
      key: bgValue.key
    })
    return undefined
  }
}

