/**
 * Aspect Ratio Resolution for Packages
 *
 * Centralizes aspect ratio resolution logic used across all server packages.
 * Handles conflicts between explicit aspect ratios and shot-type canonical ratios.
 */

import { resolveAspectRatio, type AspectRatioConfig, type AspectRatioId } from '../../elements/aspect-ratio/config'
import { type ShotTypeConfig } from '../../elements/shot-type/config'
import { Logger } from '@/lib/logger'
import type { PhotoStyleSettings } from '@/types/photo-style'

export interface AspectRatioResolutionResult {
  ratioConfig: AspectRatioConfig
  aspectRatio: AspectRatioId
  aspectRatioDescription: string
}

/**
 * Resolve aspect ratio for a package based on shot type and user settings.
 *
 * Priority:
 * 1. If explicit aspect ratio matches canonical, use it
 * 2. Otherwise, use canonical aspect ratio for the shot type
 * 3. Log debug warning if mismatch detected
 *
 * @param effectiveSettings - Resolved style settings (mutated to set aspectRatio)
 * @param shotTypeConfig - Resolved shot type configuration
 * @param packageId - Package ID for logging
 * @returns Resolved aspect ratio configuration
 */
export function resolvePackageAspectRatio(
  effectiveSettings: PhotoStyleSettings,
  shotTypeConfig: ShotTypeConfig,
  packageId: string
): AspectRatioResolutionResult {
  const explicitAspectRatio = (effectiveSettings.aspectRatio as AspectRatioId | undefined) || undefined
  const canonicalRatioConfig = resolveAspectRatio(shotTypeConfig.id)
  let ratioConfig = canonicalRatioConfig

  // Priority: Explicit aspect ratio (from package/user) takes precedence over canonical
  if (explicitAspectRatio) {
    ratioConfig = resolveAspectRatio(shotTypeConfig.id, explicitAspectRatio)

    // Log if there's a mismatch (for debugging purposes only)
    if (explicitAspectRatio !== canonicalRatioConfig.id) {
      Logger.debug('Using explicit aspect ratio override from package settings', {
        packageId,
        shotType: shotTypeConfig.id,
        canonicalAspectRatio: canonicalRatioConfig.id,
        explicitAspectRatio
      })
    }
  }

  // Update effective settings with resolved ratio
  effectiveSettings.aspectRatio = ratioConfig.id

  return {
    ratioConfig,
    aspectRatio: ratioConfig.id,
    aspectRatioDescription: `${ratioConfig.id} (${ratioConfig.width}x${ratioConfig.height})`
  }
}
