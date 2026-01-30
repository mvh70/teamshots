/**
 * Server Defaults Pattern for Package Settings
 *
 * Simple two-layer hierarchy:
 *
 * 1. Package Defaults (base layer)
 *    - Each package defines complete settings in defaultSettings
 *    - This is the single source of truth for the package
 *    - Example: pose, shotType, aspectRatio, expression, etc.
 *
 * 2. User Settings (top layer)
 *    - Settings that users customize through the UI
 *    - ONLY applied for categories in visibleCategories
 *    - Overwrites package defaults for visible categories only
 *
 * Key Insight:
 * - Package defaultSettings defines ALL categories (visible and non-visible)
 * - User settings only override visible categories
 * - Non-visible categories remain at package defaults (users can't change them)
 *
 * Usage:
 * ```typescript
 * // In BasePackageServer.resolveEffectiveSettings:
 *
 * // 1. Start with package defaults (source of truth)
 * const baseSettings = { ...pkg.defaultSettings }
 *
 * // 2. Apply user settings for visible categories only
 * const finalSettings = mergeUserSettings(baseSettings, userSettings, visibleCategories)
 * ```
 */

import { PhotoStyleSettings, CategoryType } from '@/types/photo-style'

/**
 * Returns a value or a default if the value is undefined or has type 'user-choice'/'predefined' without custom data
 * @param value - The value to check
 * @param defaultValue - The default value to return if value is invalid
 */
export function getValueOrDefault<T>(value: T | undefined | { type?: string }, defaultValue: T): T {
  if (!value) return defaultValue
  
  // If value has type: 'user-choice' or 'predefined', check if it contains actual user data
  if (typeof value === 'object' && value !== null && 'type' in value) {
    const settingsObj = value as Record<string, unknown>
    
    // For 'user-choice' or 'predefined' type, check if there's custom data beyond just the type
    if (settingsObj.type === 'user-choice' || settingsObj.type === 'predefined') {
      // Check if there's any custom data (excluding the 'type' field itself)
      const hasCustomData = Object.keys(settingsObj).some(key => {
        if (key === 'type') return false
        const val = settingsObj[key]
        // Check if the property has meaningful data
        if (val === null || val === undefined) return false
        if (typeof val === 'object') {
          // For nested objects (like colors), check if they have any properties
          return Object.keys(val as Record<string, unknown>).length > 0
        }
        return true
      })
      
      // If no custom data, use package defaults
      if (!hasCustomData) return defaultValue
    }
  }
  
  return value as T
}

/**
 * Merges user settings into base settings, but only for visible categories.
 * 
 * This preserves package standards (non-visible categories) while allowing
 * users to customize visible categories through the UI.
 * 
 * @param baseSettings - Settings with preset defaults and package standards
 * @param userSettings - Settings from team admin or invited user
 * @param visibleCategories - Categories that users can customize
 * @returns Final settings with user customizations applied only for visible categories
 */
export function mergeUserSettings(
  baseSettings: PhotoStyleSettings,
  userSettings: PhotoStyleSettings,
  visibleCategories: CategoryType[]
): PhotoStyleSettings {
  const result = { ...baseSettings }
  const visibleSet = new Set(visibleCategories)
  
  // Only apply user settings for visible categories
  // This mapping connects UI categories to PhotoStyleSettings fields
  const categoryFields: Partial<Record<CategoryType, keyof PhotoStyleSettings>> = {
    'background': 'background',
    'branding': 'branding',
    'clothing': 'clothing',
    'clothingColors': 'clothingColors',
    'customClothing': 'customClothing',
    'pose': 'pose',
    'expression': 'expression',
    'shotType': 'shotType',
    'lighting': 'lighting'
  }
  
  for (const [category, field] of Object.entries(categoryFields)) {
    if (visibleSet.has(category as CategoryType) && field && userSettings[field]) {
      // Use getValueOrDefault to check if user setting has meaningful data
      // If it's just { type: 'user-choice' } with no colors/data, keep the base default
    // Type assertion needed because we're dynamically accessing different setting types
    (result as Record<string, unknown>)[field] = getValueOrDefault<unknown>(
      userSettings[field] as unknown,
      baseSettings[field] as unknown
    )
    }
  }
  
  // Always preserve runtime context fields regardless of visibility
  if (userSettings.aspectRatio) {
    result.aspectRatio = userSettings.aspectRatio
  }
  
  if (userSettings.subjectCount) {
    result.subjectCount = userSettings.subjectCount
  }
  
  if (userSettings.usageContext) {
    result.usageContext = userSettings.usageContext
  }
  
  return result
}

