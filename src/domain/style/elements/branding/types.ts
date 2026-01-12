import type { ElementSetting } from '../base/element-types'

/**
 * Branding type (without 'user-choice' - that's handled by the wrapper)
 */
export type BrandingType = 'include' | 'exclude'

/**
 * Branding value containing the actual branding configuration
 */
export interface BrandingValue {
  type: BrandingType
  logoKey?: string // Legacy: S3 key for team logo - prefer logoAssetId
  logoAssetId?: string // Preferred: Asset ID for team logo
  position?: 'background' | 'clothing' | 'elements'
  preparedLogoKey?: string // Optimization for regenerations
}

/**
 * Branding settings using the ElementSetting wrapper pattern
 *
 * @example
 * // Admin has locked branding to include
 * { mode: 'predefined', value: { type: 'include', position: 'clothing' } }
 *
 * // User can choose (not selected yet)
 * { mode: 'user-choice', value: undefined }
 */
export type BrandingSettings = ElementSetting<BrandingValue>

/**
 * Legacy format for backward compatibility
 */
export interface LegacyBrandingSettings {
  type: 'include' | 'exclude' | 'user-choice'
  logoKey?: string
  logoAssetId?: string
  position?: 'background' | 'clothing' | 'elements'
  preparedLogoKey?: string
}

