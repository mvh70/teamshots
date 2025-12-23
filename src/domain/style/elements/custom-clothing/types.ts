/**
 * Custom Clothing Element Types
 *
 * Defines the data structures for outfit transfer customization.
 * This element allows users to upload an outfit image and have the AI
 * generate a headshot wearing similar clothing.
 */

export interface CustomClothingSettings {
  /**
   * Type of custom clothing setting
   * - 'user-choice': User can upload and customize outfit
   * - 'predefined': Custom clothing disabled (not used)
   */
  type: 'user-choice' | 'predefined'

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
  colors?: {
    topLayer: string // Hex color for visible outer garment (jacket/blazer/shirt)
    baseLayer?: string // Hex color for shirt underneath (optional, for multi-layer)
    bottom: string // Hex color for pants/skirt
    shoes?: string // Hex color for shoes (optional)
  }

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
 * Default settings for custom clothing element
 */
export const DEFAULT_CUSTOM_CLOTHING: CustomClothingSettings = {
  type: 'predefined', // Disabled by default
}
