export type ClothingColorKey = 'topLayer' | 'baseLayer' | 'bottom' | 'shoes'

export interface ColorValue {
  hex: string
  name?: string
}

export interface ClothingColorSettings {
  type: 'predefined' | 'user-choice'
  colors?: {
    topLayer?: string | ColorValue // Top layer color - the visible outer garment (jacket, blazer, hoodie, polo, etc.)
    baseLayer?: string | ColorValue // Base layer color - shirt underneath outer layer (only for multi-layer outfits)
    bottom?: string | ColorValue // Bottom color (pants, skirt, etc.)
    shoes?: string | ColorValue // Shoes color
  }
}

/**
 * Extract hex value from a color (supports both string and ColorValue)
 */
export function getColorHex(color: string | ColorValue | undefined): string | undefined {
  if (!color) return undefined
  if (typeof color === 'string') return color
  return color.hex
}

/**
 * Extract color name from a color (supports both string and ColorValue)
 */
export function getColorName(color: string | ColorValue | undefined): string | undefined {
  if (!color) return undefined
  if (typeof color === 'object' && color.name) return color.name
  return undefined
}

/**
 * Get display text for a color (name + hex or just hex)
 */
export function getColorDisplay(color: string | ColorValue | undefined): string | undefined {
  if (!color) return undefined
  if (typeof color === 'string') return color
  return color.name ? `${color.name} ${color.hex}` : color.hex
}

