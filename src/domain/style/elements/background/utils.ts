import type { PreparedAsset } from '../base/StyleElement'
import type { BackgroundSettings } from './types'
import { Logger } from '@/lib/logger'

/**
 * Resolve a logo asset from prepared assets or by downloading.
 *
 * Checks the prepared branding-logo asset first (from BrandingElement),
 * then falls back to downloading via the logo identifier.
 */
export async function resolveLogoAsset(params: {
  preparedAssets?: Map<string, PreparedAsset>
  logoKey?: string
  logoAssetId?: string
  downloadAsset?: (key: string) => Promise<{ base64: string; mimeType: string } | null>
  generationId: string
}): Promise<{ base64: string; mimeType: string } | null> {
  const { preparedAssets, logoKey, logoAssetId, downloadAsset, generationId } = params
  const logoIdentifier = logoKey || logoAssetId

  // Try prepared asset first (from BrandingElement)
  const preparedLogoAsset = preparedAssets?.get('branding-logo')
  if (preparedLogoAsset?.data.base64) {
    return {
      base64: preparedLogoAsset.data.base64,
      mimeType: preparedLogoAsset.data.mimeType || 'image/png',
    }
  }

  // Fall back to downloading
  if (logoIdentifier && downloadAsset) {
    try {
      const logoImage = await downloadAsset(logoIdentifier)
      if (logoImage?.base64) {
        return { base64: logoImage.base64, mimeType: logoImage.mimeType }
      }
    } catch (error) {
      Logger.warn('[BackgroundElement] Failed to download logo for branding', {
        generationId,
        logoIdentifier,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return null
}

/**
 * Gets the effective background key (prefers assetId, falls back to key)
 * Use this when you need an identifier for the background image
 */
export function getBackgroundIdentifier(background?: BackgroundSettings): string | undefined {
  if (!background || !background.value) return undefined
  return background.value.assetId ?? background.value.key
}
