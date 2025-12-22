import type { ClothingColorSettings } from '@/domain/style/elements/clothing-colors/types'

const STORAGE_KEY = 'teamshots_clothing_colors'

export function saveClothingColors(
  colors: ClothingColorSettings['colors']
): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(colors))
  } catch (error) {
    console.warn('Failed to save clothing colors to session:', error)
  }
}

export function loadClothingColors(): ClothingColorSettings['colors'] | null {
  if (typeof window === 'undefined') return null
  
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    
    const parsed = JSON.parse(stored)
    
    // Validate structure
    if (typeof parsed !== 'object' || parsed === null) return null
    
    // Ensure all values are strings (basic validation)
    const validColors: Record<string, string> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        validColors[key] = value
      }
    }
    
    if (Object.keys(validColors).length === 0) return null
    
    return validColors as ClothingColorSettings['colors']
  } catch (error) {
    console.warn('Failed to load clothing colors from session:', error)
    return null
  }
}

export function clearClothingColors(): void {
  if (typeof window === 'undefined') return
  
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear clothing colors from session:', error)
  }
}
