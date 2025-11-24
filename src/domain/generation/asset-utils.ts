/**
 * Asset Utilities
 * 
 * Centralized utilities for loading and processing generation assets
 * (logos, backgrounds, etc.)
 */

import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ReferenceImage, DownloadAssetFn } from '@/types/generation'

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
  // Check if logo should be included
  if (styleSettings.branding?.type !== 'include') {
    return undefined
  }

  // Check if logo key is provided
  if (!styleSettings.branding.logoKey) {
    Logger.debug('Logo branding enabled but no logoKey provided')
    return undefined
  }

  try {
    const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
    
    if (!logoAsset) {
      Logger.warn('Logo asset download returned null', {
        logoKey: styleSettings.branding.logoKey
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
      logoKey: styleSettings.branding.logoKey
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
  // Only load if position is clothing
  if (styleSettings.branding?.position !== 'clothing') {
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
  if (styleSettings.background?.type !== 'custom' || !styleSettings.background.key) {
    return undefined
  }

  try {
    const backgroundAsset = await downloadAsset(styleSettings.background.key)
    
    if (!backgroundAsset) {
      Logger.warn('Background asset download returned null', {
        key: styleSettings.background.key
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
      key: styleSettings.background.key
    })
    return undefined
  }
}

