import { getPackageConfig } from './packages'

/**
 * Helper to check if a category setting indicates user-choice (editable).
 * Supports both new format (mode) and legacy format (type/style).
 */
function isCategoryUserChoice(categoryKey: string, settings: Record<string, unknown> | undefined): boolean {
  if (!settings) return false

  if (categoryKey === 'clothing') {
    return settings.style === 'user-choice' || settings.mode === 'user-choice'
  }

  // Check new format (mode) first, then legacy format (type)
  return settings.mode === 'user-choice' || settings.type === 'user-choice'
}

/**
 * Determines which categories are user-editable based on:
 * 1. Original context settings (if admin marked as user-choice)
 * 2. Package's userStyleCategories as fallback
 *
 * This is the source of truth for whether a field should be highlighted
 * in the sequential focus flow.
 *
 * @param originalSettings - The original context settings (from admin or package defaults)
 * @param packageId - Package ID to get configuration
 * @returns Set of category keys that are user-editable
 */
export function getEditableCategories(
  originalSettings: Record<string, unknown> | undefined,
  packageId: string
): Set<string> {
  const pkg = getPackageConfig(packageId)
  const editable = new Set<string>()
  const visibleCategories = pkg.visibleCategories || []

  // If we have original settings, use them as source of truth
  // The original settings reflect what the admin configured as editable
  if (originalSettings) {
    for (const categoryKey of visibleCategories) {
      const settings = originalSettings[categoryKey] as Record<string, unknown> | undefined
      if (isCategoryUserChoice(categoryKey, settings)) {
        editable.add(categoryKey)
      }
    }

    // IMPORTANT: Do NOT fall back to userStyleCategories when originalSettings exist.
    // If admin predefined all categories, that's intentional - user should skip customization.
    // The fallback only applies when there are NO originalSettings at all.

    return editable
  }

  // No original settings - use package's userStyleCategories as baseline
  const userStyleCategories = pkg.userStyleCategories || []
  userStyleCategories.forEach(cat => {
    if (visibleCategories.includes(cat)) {
      editable.add(cat)
    }
  })

  return editable
}

export function hasUserDefinedFields(obj: unknown): boolean {
  const seen = new Set<unknown>()
  const normalize = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[\u2010-\u2015]/g, '-').trim() : ''

  const walk = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    if (seen.has(node)) return false
    seen.add(node)

    const record = node as Record<string, unknown>
    // Check for new format (mode) first, then legacy format (type)
    const m = (record as { mode?: unknown }).mode
    const t = (record as { type?: unknown }).type
    if (normalize(m) === 'user-choice' || normalize(t) === 'user-choice') return true

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

/**
 * Checks if there are any editable fields that haven't been customized yet.
 * Uses getUneditedEditableFieldNames() for consistent logic.
 *
 * @param current - Current photo style settings
 * @param original - Original context settings to compare against
 * @param packageId - Package ID to determine which categories are editable
 * @returns true if there are unedited editable fields, false otherwise
 */
export function hasUneditedEditableFields(
  current: Record<string, unknown>,
  original: Record<string, unknown> | undefined,
  packageId?: string,
  options?: { includeDefaultValues?: boolean }
): boolean {
  // If no packageId, use legacy behavior with hasUserDefinedFields
  if (!packageId) {
    return hasUserDefinedFields(current)
  }

  // Use getUneditedEditableFieldNames for consistent logic
  const uneditedFields = getUneditedEditableFieldNames(current, original, packageId, options)
  return uneditedFields.length > 0
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
    // Support both new format (mode) and legacy format (type)
    let isUserChoice = false
    if (categoryKey === 'clothing') {
      isUserChoice = settings.style === 'user-choice'
    } else {
      isUserChoice = settings.mode === 'user-choice' || settings.type === 'user-choice'
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
      // Resolve clothingColors the same way the UI does - merge defaults with current values
      const packageDefaults = pkg.defaultSettings?.clothingColors
      // Support both old format (colors) and new format (value)
      const pkgDefaultsRecord = packageDefaults as { colors?: Record<string, unknown>; value?: Record<string, unknown> } | undefined
      const defaultColors = pkgDefaultsRecord?.colors || pkgDefaultsRecord?.value || {}
      // Support both old format (colors) and new format (value)
      const currentColors = (settings.colors as Record<string, unknown>) ||
                           (settings.value as Record<string, unknown>) || {}

      // Merge defaults with current (same logic as PhotoStyleSettings.tsx resolvedClothingColors)
      const resolvedColors = {
        ...defaultColors,
        ...currentColors
      }

      // Check if resolved colors have any values set
      const hasColors = !!(resolvedColors.topLayer || resolvedColors.baseLayer || resolvedColors.bottom || resolvedColors.shoes)

      // If no colors are set (neither in current nor defaults), it's not customized
      if (!hasColors) {
        return false // clothingColors is user-choice but no colors set and no package defaults
      }
      // If colors exist (either from current settings or defaults), consider it as finished
    } else if (categoryKey === 'branding') {
      // Special handling for branding: the UI shows "No Logo" as a valid default
      // selection when value is undefined. Unlike other categories, undefined here
      // represents a meaningful choice (exclude logo), so branding is always
      // considered "customized" - the user can accept the default without interaction.
      continue
    } else {
      // For other categories, if type/style/mode is still 'user-choice', it means not customized
      // When user selects an option, type/mode changes from 'user-choice' to 'predefined' with a value
      if (categoryKey === 'clothing') {
        if (settings.style === 'user-choice') {
          return false // Still 'user-choice', not customized
        }
      } else {
        // Check both mode (new format) and type (legacy format)
        if (settings.mode === 'user-choice' || settings.type === 'user-choice') {
          return false // Still 'user-choice', not customized
        }
      }
    }
  }
  
  return true // All customizable sections are customized
}

/**
 * Returns array of category keys that are still unedited (user-choice with no changes).
 * Used by FlowProgressDock to show "Set: pose, colors, ..." status text and for
 * highlighting the next field in the sequential focus flow.
 *
 * @param current - Current photo style settings
 * @param original - Original context settings to compare against (can be undefined)
 * @param packageId - Package ID to determine visible categories
 * @param options.includeDefaultValues - When true, fields whose current value matches the
 *   package default are also considered "unedited". Use this for progressive activation
 *   (visual guidance) where you want to highlight ALL fields the user hasn't touched,
 *   even those with pre-populated defaults. Default false (original behavior).
 * @returns Array of category keys that need to be edited (in visibleCategories order)
 */
export function getUneditedEditableFieldNames(
  current: Record<string, unknown>,
  original: Record<string, unknown> | undefined,
  packageId: string,
  options?: { includeDefaultValues?: boolean }
): string[] {
  const pkg = getPackageConfig(packageId)
  const visibleCategories = pkg.visibleCategories || []

  // Use package defaults as fallback when original settings are missing
  const effectiveOriginal = original || (pkg.defaultSettings as Record<string, unknown>) || {}

  // Get editable categories from the proper source of truth
  // This checks originalSettings first, then falls back to package's userStyleCategories
  const editableCategories = getEditableCategories(effectiveOriginal, packageId)

  const unedited: string[] = []

  for (const categoryKey of visibleCategories) {
    // Only consider categories that are editable (user-choice)
    if (!editableCategories.has(categoryKey)) continue

    const currentSettings = current[categoryKey] as Record<string, unknown> | undefined
    const originalSettings = effectiveOriginal[categoryKey] as Record<string, unknown> | undefined

    // If current settings don't exist, the category needs to be edited
    if (!currentSettings) {
      unedited.push(categoryKey)
      continue
    }

    // Special handling for clothingColors - check if any colors set
    if (categoryKey === 'clothingColors') {
      // Resolve colors with package defaults (same logic as PhotoStyleSettings)
      const packageDefaults = pkg.defaultSettings?.clothingColors
      // Support both old format (colors) and new format (value)
      const pkgDefaultsRecord = packageDefaults as { colors?: Record<string, unknown>; value?: Record<string, unknown> } | undefined
      const defaultColors = pkgDefaultsRecord?.colors || pkgDefaultsRecord?.value || {}
      // Support both old format (colors) and new format (value)
      const currentColors = (currentSettings.colors as Record<string, unknown>) ||
                           (currentSettings.value as Record<string, unknown>) || {}
      const originalColors = (originalSettings?.colors as Record<string, unknown>) ||
                           (originalSettings?.value as Record<string, unknown>) || {}

      const resolvedColors = {
        ...defaultColors,
        ...currentColors
      }
      const resolvedOriginalColors = {
        ...defaultColors,
        ...originalColors
      }

      const hasColors = !!(resolvedColors.topLayer || resolvedColors.baseLayer || resolvedColors.bottom || resolvedColors.shoes)
      if (!hasColors) {
        unedited.push(categoryKey)
      } else if (options?.includeDefaultValues && originalSettings) {
        // Treat untouched default/preset colors as unedited until explicitly accepted/changed.
        if (JSON.stringify(resolvedColors) === JSON.stringify(resolvedOriginalColors)) {
          unedited.push(categoryKey)
        }
      }
    } else if (categoryKey === 'branding') {
      // Branding defaults to "No Logo" which is a valid choice.
      // For progressive activation (includeDefaultValues), include it as a stop
      // so users acknowledge it. Value is set to null once acknowledged (Tab/click).
      // Without includeDefaultValues, skip it — no explicit interaction required.
      if (options?.includeDefaultValues && currentSettings.value === undefined) {
        unedited.push(categoryKey)
      }
    } else {
      // For other categories, check if a value has been set
      const hasValue = currentSettings.value !== undefined

      if (!hasValue) {
        // No value at all - check if it's a user-choice field
        const isUserChoiceWithNoValue =
          (currentSettings.mode === 'user-choice' && currentSettings.value === undefined) ||
          (currentSettings.type === 'user-choice')

        if (isUserChoiceWithNoValue) {
          unedited.push(categoryKey)
        }
      } else if (options?.includeDefaultValues && originalSettings) {
        // Has a value but matches the original/default exactly.
        // The user hasn't actively changed it - treat as "unedited" for visual guidance.
        // Only applies when includeDefaultValues is true (progressive activation).
        if (JSON.stringify(currentSettings) === JSON.stringify(originalSettings)) {
          unedited.push(categoryKey)
        }
      }
    }
  }

  return unedited
}
