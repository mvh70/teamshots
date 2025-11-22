import { getPackageConfig } from './packages'

export function hasUserDefinedFields(obj: unknown): boolean {
  const seen = new Set<unknown>()
  const normalize = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[\u2010-\u2015]/g, '-').trim() : ''

  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (seen.has(node)) return false
    seen.add(node)

    const record = node as Record<string, unknown>
    const t = (record as { type?: unknown }).type
    if (normalize(t) === 'user-choice') return true

    for (const value of Object.values(record)) {
      if (Array.isArray(value)) {
        if (value.some(walk)) return true
      } else if (typeof value === 'object' && value !== null) {
        if (walk(value)) return true
      } else if (typeof value === 'string') {
        if (normalize(value) === 'user-choice') return true
      }
    }
    return false
  }

  return walk(obj)
}

export function hasUneditedEditableFields(
  current: Record<string, unknown>,
  original: Record<string, unknown>
): boolean {
  // First check if there are any editable fields at all
  if (!hasUserDefinedFields(current)) {
    return false
  }

  const seen = new Set<unknown>()
  const normalize = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[\u2010-\u2015]/g, '-').trim() : ''

  const walk = (node: unknown, originalNode: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (!originalNode || typeof originalNode !== 'object') return false
    if (seen.has(node)) return false
    seen.add(node)

    const currentRecord = node as Record<string, unknown>
    const originalRecord = originalNode as Record<string, unknown>
    const currentType = (currentRecord as { type?: unknown }).type

    // If this is a user-choice field, check if it has been modified
    if (normalize(currentType) === 'user-choice') {
      // Compare the current and original objects
      return JSON.stringify(currentRecord) === JSON.stringify(originalRecord)
    }

    // Recursively check nested objects
    for (const key of Object.keys(currentRecord)) {
      const currentValue = currentRecord[key]
      const originalValue = originalRecord[key]

      if (Array.isArray(currentValue)) {
        if (Array.isArray(originalValue)) {
          for (let i = 0; i < currentValue.length; i++) {
            if (walk(currentValue[i], originalValue[i])) return true
          }
        }
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        if (typeof originalValue === 'object' && originalValue !== null) {
          if (walk(currentValue, originalValue)) return true
        }
      } else if (typeof currentValue === 'string') {
        if (normalize(currentValue) === 'user-choice' && currentValue === originalValue) {
          return true
        }
      }
    }
    return false
  }

  return walk(current, original)
}

/**
 * Validates that all customizable sections (type: 'user-choice') have been customized.
 * This function is composable and works with any package configuration.
 * 
 * @param photoStyleSettings - The current photo style settings
 * @param packageId - The package ID to determine which categories are visible
 * @param originalSettings - Optional original settings to determine which categories were initially customizable
 * @returns true if all customizable sections are customized, false otherwise
 */
export function areAllCustomizableSectionsCustomized(
  photoStyleSettings: Record<string, unknown>,
  packageId: string,
  originalSettings?: Record<string, unknown>
): boolean {
  if (!photoStyleSettings) return true // No settings means nothing to customize
  
  // Get package config to determine visible categories
  const pkg = getPackageConfig(packageId)
  
  // Get visible categories from package config
  const visibleCategories = pkg.visibleCategories || []
  
  // Determine which categories were initially customizable (user-choice)
  // Use originalSettings if provided, otherwise check current settings
  const initiallyCustomizable = new Set<string>()
  
  const settingsToCheck = originalSettings || photoStyleSettings
  
  for (const categoryKey of visibleCategories) {
    const categorySettings = settingsToCheck[categoryKey]
    if (!categorySettings || typeof categorySettings !== 'object') continue
    
    const settings = categorySettings as Record<string, unknown>
    
    // Check if this category is user-choice (customizable)
    let isUserChoice = false
    if (categoryKey === 'clothing') {
      isUserChoice = settings.style === 'user-choice'
    } else {
      isUserChoice = settings.type === 'user-choice'
    }
    
    if (isUserChoice) {
      initiallyCustomizable.add(categoryKey)
    }
  }
  
  // If no customizable sections, return true
  if (initiallyCustomizable.size === 0) return true
  
  // Check that all initially customizable categories have been customized
  for (const categoryKey of initiallyCustomizable) {
    const currentSettings = photoStyleSettings[categoryKey]
    if (!currentSettings || typeof currentSettings !== 'object') {
      return false // Category missing, not customized
    }
    
    const settings = currentSettings as Record<string, unknown>
    
    if (categoryKey === 'clothingColors') {
      // For clothingColors, check if colors are set
      const colors = (settings.colors as Record<string, unknown>) || {}
      const hasColors = !!(colors.topCover || colors.topBase || colors.bottom || colors.shoes)
      if (!hasColors) {
        return false // clothingColors is user-choice but no colors set
      }
    } else {
      // For other categories, if type/style is still 'user-choice', it means not customized
      // When user selects an option, type changes from 'user-choice' to the actual value
      if (categoryKey === 'clothing') {
        if (settings.style === 'user-choice') {
          return false // Still 'user-choice', not customized
        }
      } else {
        if (settings.type === 'user-choice') {
          return false // Still 'user-choice', not customized
        }
      }
    }
  }
  
  return true // All customizable sections are customized
}
