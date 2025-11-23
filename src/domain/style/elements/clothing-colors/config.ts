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
  'silver': '#C0C0C0'
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
  
  // First check common mappings for exact matches (faster)
  const commonMapping = COMMON_COLOR_MAPPINGS[lowerColor]
  if (commonMapping) return commonMapping
  
  // Then look up in the full color database
  const hex = colorMap.get(lowerColor)
  
  return hex || '#ffffff' // fallback to white if not found
}

