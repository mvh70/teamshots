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

