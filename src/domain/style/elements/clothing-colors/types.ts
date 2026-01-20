import type { ElementSetting } from '../base/element-types'
import { hexToColorName } from '@/lib/color-utils'

export type ClothingColorKey = 'topLayer' | 'baseLayer' | 'bottom' | 'shoes'

export interface ColorValue {
  hex: string
  name?: string
}

/**
 * Clothing color values without mode information
 */
export interface ClothingColorValue {
  topLayer?: string | ColorValue // Top layer color - the visible outer garment (jacket, blazer, hoodie, polo, etc.)
  baseLayer?: string | ColorValue // Base layer color - shirt underneath outer layer (only for multi-layer outfits)
  bottom?: string | ColorValue // Bottom color (pants, skirt, etc.)
  shoes?: string | ColorValue // Shoes color
  source?: 'outfit' | 'manual' // Source of colors: 'outfit' means from uploaded outfit (skip prompt), 'manual' means user-picked
}

/**
 * Clothing color settings with mode wrapper
 * - mode: 'predefined' means admin has set specific colors
 * - mode: 'user-choice' means the user can choose their colors
 */
export type ClothingColorSettings = ElementSetting<ClothingColorValue>

// Legacy type alias for backward compatibility during migration
export interface LegacyClothingColorSettings {
  type: 'predefined' | 'user-choice'
  colors?: ClothingColorValue
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
 * Get display text for a color (semantic name + hex)
 * Always includes semantic name for better AI understanding
 */
export function getColorDisplay(color: string | ColorValue | undefined): string | undefined {
  if (!color) return undefined
  
  // Get hex value
  const hex = typeof color === 'string' ? color : color.hex
  if (!hex) return undefined
  
  // Get name - use provided name or derive from hex
  const name = typeof color === 'object' && color.name 
    ? color.name 
    : hexToColorName(hex)
  
  // Return "Semantic Name (#HEX)" format for AI clarity
  return `${name} (${hex})`
}

/**
 * Extract all colors from a ClothingColorValue as hex strings
 * Useful for passing to components that need consistent hex format
 */
export function extractHexColors(colors: ClothingColorValue | undefined): {
  topLayer?: string
  baseLayer?: string
  bottom?: string
  shoes?: string
} {
  if (!colors) return {}
  return {
    topLayer: getColorHex(colors.topLayer),
    baseLayer: getColorHex(colors.baseLayer),
    bottom: getColorHex(colors.bottom),
    shoes: getColorHex(colors.shoes)
  }
}

/**
 * Check if a color value is a valid hex color (starts with #)
 * Color names like 'Dark red' are not valid hex colors
 */
export function isValidHexColor(color: string | ColorValue | undefined): boolean {
  const hex = getColorHex(color)
  return hex !== undefined && hex.startsWith('#')
}

