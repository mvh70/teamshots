/**
 * Custom Clothing Element Types
 *
 * Defines the data structures for outfit transfer customization.
 * This element allows users to upload an outfit image and have the AI
 * generate a headshot wearing similar clothing.
 */

export interface CustomClothingSettings {
  /**
   * Whether custom clothing is enabled
   */
  enabled: boolean

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
   * Dominant colors extracted from the outfit
   */
  colors?: {
    topBase: string // Hex color for base shirt/top
    topCover?: string // Hex color for jacket/blazer (optional)
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
  enabled: false,
}
