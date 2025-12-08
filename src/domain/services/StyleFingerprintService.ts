import { createHash } from 'crypto'

/**
 * Style parameters that affect the fingerprint.
 * Only include parameters that, when changed, would require regeneration.
 */
export interface StyleFingerprintParams {
  // Core style identifiers
  packageId?: string
  stylePreset?: string

  // Background
  backgroundType?: string
  backgroundColor?: string
  backgroundGradient?: string

  // Branding
  brandingType?: string
  brandingPosition?: string

  // Aspect ratio and dimensions
  aspectRatio?: string

  // Expression and pose
  expression?: string
  pose?: string

  // Lighting
  lighting?: string

  // Shot type
  shotType?: string

  // Clothing
  clothingType?: string
  clothingColor?: string

  // Additional style parameters
  [key: string]: unknown
}

/**
 * Style Fingerprint Service
 *
 * Creates deterministic fingerprints for identifying reusable intermediate assets.
 * A fingerprint is a hash of the input asset IDs and style parameters.
 *
 * Important: Use Asset IDs (not S3 keys) for deterministic fingerprints.
 */
export class StyleFingerprintService {
  /**
   * Create a deterministic fingerprint from parent assets and style parameters.
   *
   * @param parentAssetIds - Array of Asset IDs that were used as inputs
   * @param styleParams - Style parameters that affect the output
   * @param subType - Optional sub-type for more specific fingerprints (e.g., 'person_on_white')
   * @returns A SHA-256 hash string
   */
  static createFingerprint(
    parentAssetIds: string[],
    styleParams: StyleFingerprintParams,
    subType?: string
  ): string {
    // Sort asset IDs for consistency
    const sortedAssetIds = [...parentAssetIds].sort()

    // Extract and normalize style parameters
    const normalizedParams = this.normalizeParams(styleParams)

    // Build fingerprint input
    const fingerprintInput = {
      assets: sortedAssetIds,
      style: normalizedParams,
      subType: subType ?? null,
    }

    // Create hash
    const hash = createHash('sha256')
    hash.update(JSON.stringify(fingerprintInput))
    return hash.digest('hex')
  }

  /**
   * Create a fingerprint for Step 1a (person on white background).
   * Depends on selfie assets and person-specific style settings.
   */
  static createPersonFingerprint(
    selfieAssetIds: string[],
    styleParams: {
      aspectRatio?: string
      expression?: string
      pose?: string
      shotType?: string
      clothingType?: string
      clothingColor?: string
      lighting?: string
    }
  ): string {
    return this.createFingerprint(selfieAssetIds, styleParams, 'person_on_white')
  }

  /**
   * Create a fingerprint for Step 1b (background with branding).
   * Depends on background asset, logo asset, and branding settings.
   */
  static createBackgroundFingerprint(
    backgroundAssetId: string | null,
    logoAssetId: string | null,
    styleParams: {
      backgroundType?: string
      backgroundColor?: string
      backgroundGradient?: string
      brandingPosition?: string
      aspectRatio?: string
    }
  ): string {
    const assetIds: string[] = []
    if (backgroundAssetId) {
      assetIds.push(backgroundAssetId)
    }
    if (logoAssetId) {
      assetIds.push(logoAssetId)
    }

    return this.createFingerprint(assetIds, styleParams, 'background_with_branding')
  }

  /**
   * Create a fingerprint for final composition.
   * Combines person and background fingerprints.
   */
  static createCompositionFingerprint(
    personAssetId: string,
    backgroundAssetId: string | null,
    styleParams: StyleFingerprintParams
  ): string {
    const assetIds = [personAssetId]
    if (backgroundAssetId) {
      assetIds.push(backgroundAssetId)
    }

    return this.createFingerprint(assetIds, styleParams, 'final_composition')
  }

  /**
   * Validate that a fingerprint matches expected inputs.
   * Useful for verifying cache hits are valid.
   */
  static validateFingerprint(
    expectedFingerprint: string,
    parentAssetIds: string[],
    styleParams: StyleFingerprintParams,
    subType?: string
  ): boolean {
    const computedFingerprint = this.createFingerprint(
      parentAssetIds,
      styleParams,
      subType
    )
    return computedFingerprint === expectedFingerprint
  }

  /**
   * Normalize style parameters for consistent hashing.
   * - Removes undefined/null values
   * - Sorts object keys
   * - Normalizes string values (lowercase, trimmed)
   */
  private static normalizeParams(
    params: StyleFingerprintParams
  ): Record<string, unknown> {
    const normalized: Record<string, unknown> = {}

    // Get sorted keys
    const keys = Object.keys(params).sort()

    for (const key of keys) {
      const value = params[key]

      // Skip undefined/null values
      if (value === undefined || value === null) {
        continue
      }

      // Normalize strings
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed.length > 0) {
          normalized[key] = trimmed.toLowerCase()
        }
        continue
      }

      // Normalize nested objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        const nested = this.normalizeParams(value as StyleFingerprintParams)
        if (Object.keys(nested).length > 0) {
          normalized[key] = nested
        }
        continue
      }

      // Normalize arrays
      if (Array.isArray(value)) {
        const normalizedArray = value
          .filter((v) => v !== undefined && v !== null)
          .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v))
          .sort()
        if (normalizedArray.length > 0) {
          normalized[key] = normalizedArray
        }
        continue
      }

      // Keep other values as-is
      normalized[key] = value
    }

    return normalized
  }

  /**
   * Extract fingerprint-relevant params from PhotoStyleSettings
   */
  static extractFromStyleSettings(
    styleSettings: Record<string, unknown>
  ): StyleFingerprintParams {
    return {
      packageId: styleSettings.packageId as string | undefined,
      stylePreset: styleSettings.stylePreset as string | undefined,
      backgroundType: (styleSettings.background as { type?: string } | undefined)?.type,
      backgroundColor: (styleSettings.background as { color?: string } | undefined)?.color,
      backgroundGradient: (styleSettings.background as { gradient?: string } | undefined)?.gradient,
      brandingType: (styleSettings.branding as { type?: string } | undefined)?.type,
      brandingPosition: (styleSettings.branding as { position?: string } | undefined)?.position,
      aspectRatio: styleSettings.aspectRatio as string | undefined,
      expression: (styleSettings.expression as { type?: string } | undefined)?.type,
      pose: (styleSettings.pose as { type?: string } | undefined)?.type,
      lighting: (styleSettings.lighting as { type?: string } | undefined)?.type,
      shotType: (styleSettings.shotType as { type?: string } | undefined)?.type,
      clothingType: (styleSettings.clothing as { type?: string } | undefined)?.type,
      clothingColor: (styleSettings.clothingColors as { primary?: string } | undefined)?.primary,
    }
  }
}
