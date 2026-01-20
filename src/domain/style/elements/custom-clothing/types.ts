/**
 * Custom Clothing Element Types
 *
 * Defines the data structures for outfit transfer customization.
 * This element allows users to upload an outfit image and have the AI
 * generate a headshot wearing similar clothing.
 */

/**
 * Dominant colors extracted from the outfit
 */
export interface CustomClothingColors {
  topLayer: string // Hex color for visible outer garment (jacket/blazer/shirt)
  baseLayer?: string // Hex color for shirt underneath (optional, for multi-layer)
  bottom: string // Hex color for pants/skirt
  shoes?: string // Hex color for shoes (optional)
}

/**
 * The inner value containing custom clothing configuration
 */
export interface CustomClothingValue {
  /**
   * S3 key of the uploaded outfit image
   * This photo will be processed during generation to extract individual garments
   */
  outfitS3Key?: string

  /**
   * Asset ID of the uploaded outfit image (PREFERRED)
   */
  assetId?: string

  /**
   * S3 key of the generated garment collage (cached)
   * This is the processed image showing individual clothing items extracted from the outfit
   * Cached to avoid regenerating for team members using the same outfit
   */
  collageS3Key?: string

  /**
   * Dominant colors extracted from the outfit
   */
  colors?: CustomClothingColors

  /**
   * Natural language description of the outfit
   * Example: "Light gray dress shirt under a charcoal blazer with dark navy trousers"
   */
  description?: string

  /**
   * When the outfit was uploaded/analyzed
   */
  uploadedAt?: string
}

/**
 * Full custom clothing settings with mode wrapper (matches ElementSetting pattern)
 * - 'predefined': Custom clothing disabled (admin locked it off)
 * - 'user-choice': User can upload and customize outfit
 */
export interface CustomClothingSettings {
  mode: 'predefined' | 'user-choice'
  value?: CustomClothingValue
}

/**
 * Default settings for custom clothing element
 */
export const DEFAULT_CUSTOM_CLOTHING: CustomClothingSettings = {
  mode: 'predefined', // Disabled by default
}
