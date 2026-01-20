import { colornames } from 'color-name-list'

// Common color name variations used in presets that need explicit mapping
export const COMMON_COLOR_MAPPINGS: Record<string, string> = {
  'dark blue': '#00008B',
  'navy': '#000080',
  'white': '#FFFFFF',
  'black': '#000000',
  'gray': '#808080',
  'grey': '#808080',
  'charcoal': '#36454F',
  'brown': '#8B4513',
  'beige': '#F5F5DC',
  'burgundy': '#800020',
  'blue': '#0000FF',
  'light blue': '#ADD8E6',
  'red': '#FF0000',
  'green': '#008000',
  'yellow': '#FFFF00',
  'orange': '#FFA500',
  'purple': '#800080',
  'pink': '#FFC0CB',
  'tan': '#D2B48C',
  'cream': '#FFFDD0',
  'khaki': '#F0E68C',
  'olive': '#808000',
  'maroon': '#800000',
  'teal': '#008080',
  'silver': '#C0C0C0',
  'gold': '#FFD700',
  'off white': '#F8F8FF',
  'off-white': '#F8F8FF'
}

// Create a lookup map for fast color name to hex conversion from the full database
const colorMap = new Map(
  colornames.map(color => [color.name.toLowerCase(), color.hex])
)

/**
 * Normalizes a color value to hex format
 * @param color - Color name (e.g., "Dark blue") or hex value (e.g., "#00008B")
 * @returns Hex color value
 */
export function normalizeColorToHex(color: string | undefined): string {
  if (!color) return '#ffffff'
  
  // If it's already a hex color, return it
  if (color.startsWith('#')) return color
  
  const lowerColor = color.toLowerCase()
  
  // 1. Exact match
  const commonMapping = COMMON_COLOR_MAPPINGS[lowerColor]
  if (commonMapping) return commonMapping
  
  const hex = colorMap.get(lowerColor)
  if (hex) return hex

  // 2. Partial match in COMMON_COLOR_MAPPINGS
  // Find the longest key from COMMON_COLOR_MAPPINGS that appears as a whole word in the input
  let bestMatchKey = ''
  
  for (const key of Object.keys(COMMON_COLOR_MAPPINGS)) {
    // Check if key is present as a whole word
    if (new RegExp(`\\b${key}\\b`).test(lowerColor)) {
      if (key.length > bestMatchKey.length) {
        bestMatchKey = key
      }
    }
  }
  
  if (bestMatchKey) {
    return COMMON_COLOR_MAPPINGS[bestMatchKey]
  }

  // 3. Fallback: Check individual words against the full color map
  const words = lowerColor.split(/[\s-_]+/)
  for (const word of words) {
    const wordHex = colorMap.get(word)
    if (wordHex) return wordHex
  }
  
  return '#ffffff' // fallback to white if not found
}

// Create a reverse lookup map for hex to color name (exact matches)
const hexToNameMap = new Map(
  colornames.map(color => [color.hex.toLowerCase(), color.name])
)

/**
 * Converts hex color to RGB object
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace('#', '')
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

/**
 * Calculates Euclidean distance between two RGB colors
 */
function colorDistance(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
    Math.pow(rgb1.g - rgb2.g, 2) +
    Math.pow(rgb1.b - rgb2.b, 2)
  )
}

/**
 * Finds the closest color name for a hex value by calculating color distance
 */
function findClosestColorName(hex: string): string {
  const target = hexToRgb(hex)
  if (!target) return 'Unknown'
  
  let closestColor = colornames[0]
  let minDistance = Infinity
  
  for (const color of colornames) {
    const rgb = hexToRgb(color.hex)
    if (!rgb) continue
    
    const distance = colorDistance(target, rgb)
    
    if (distance < minDistance) {
      minDistance = distance
      closestColor = color
    }
  }
  
  return closestColor.name
}

/**
 * Converts a hex color to a semantic color name
 * @param hex - Hex color value (e.g., "#00008B" or "00008B")
 * @returns Semantic color name (e.g., "Dark Blue")
 */
export function hexToColorName(hex: string): string {
  if (!hex) return 'Unknown'
  
  // Normalize hex format
  const normalizedHex = hex.startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`
  
  // 1. Try exact match in the color database
  const exactMatch = hexToNameMap.get(normalizedHex)
  if (exactMatch) return exactMatch
  
  // 2. Try exact match in common color mappings (reverse lookup)
  for (const [name, mappedHex] of Object.entries(COMMON_COLOR_MAPPINGS)) {
    if (mappedHex.toLowerCase() === normalizedHex) {
      // Capitalize first letter of each word
      return name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }
  }
  
  // 3. Find closest color by RGB distance
  return findClosestColorName(normalizedHex)
}

/**
 * Converts a hex color to a semantic color name with distance info
 * @param hex - Hex color value (e.g., "#00008B")
 * @returns Object with color name, hex of matched color, and whether it was exact
 */
export function hexToColorNameWithInfo(hex: string): { name: string; matchedHex: string; isExact: boolean } {
  if (!hex) return { name: 'Unknown', matchedHex: '', isExact: false }
  
  const normalizedHex = hex.startsWith('#') ? hex.toLowerCase() : `#${hex.toLowerCase()}`
  
  // 1. Try exact match in the color database
  const exactMatch = hexToNameMap.get(normalizedHex)
  if (exactMatch) {
    return { name: exactMatch, matchedHex: normalizedHex, isExact: true }
  }
  
  // 2. Try exact match in common color mappings
  for (const [name, mappedHex] of Object.entries(COMMON_COLOR_MAPPINGS)) {
    if (mappedHex.toLowerCase() === normalizedHex) {
      const capitalizedName = name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
      return { name: capitalizedName, matchedHex: mappedHex, isExact: true }
    }
  }
  
  // 3. Find closest color
  const target = hexToRgb(normalizedHex)
  if (!target) return { name: 'Unknown', matchedHex: '', isExact: false }
  
  let closestColor = colornames[0]
  let minDistance = Infinity
  
  for (const color of colornames) {
    const rgb = hexToRgb(color.hex)
    if (!rgb) continue
    
    const distance = colorDistance(target, rgb)
    if (distance < minDistance) {
      minDistance = distance
      closestColor = color
    }
  }
  
  return { name: closestColor.name, matchedHex: closestColor.hex, isExact: false }
}

