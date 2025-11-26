/**
 * Server Defaults Pattern for Package Settings
 * 
 * This module implements the correct priority hierarchy for style settings:
 * 
 * 1. Preset Defaults (base layer)
 *    - Base settings from presets like CORPORATE_HEADSHOT
 *    - Provides sensible defaults for all categories
 * 
 * 2. Package Defaults (middle layer)
 *    - Settings defined by the package for ALL categories
 *    - Overwrites preset defaults to establish package baseline
 *    - Example: pose='jacket_reveal', shotType='medium-shot', background='gradient'
 * 
 * 3. User/Admin Settings (top layer)
 *    - Settings that users customize through the UI
 *    - ONLY applied for categories in visibleCategories
 *    - Overwrites package defaults for visible categories only
 *    - Example: If 'expression' is visible, user can choose 'contemplative'
 * 
 * Key Insight:
 * - Package defaults apply to ALL categories (visible and non-visible)
 * - User settings only override visible categories
 * - Non-visible categories remain at package defaults (users can't change them)
 * 
 * Usage:
 * ```typescript
 * // In buildGenerationPayload:
 * 
 * // 1. Get preset defaults (base layer)
 * const { settings: presetDefaults } = applyStandardPreset(presetId, {}, presets)
 * 
 * // 2. Apply package defaults for ALL categories (middle layer)
 * const withPackageDefaults = ensureServerDefaults(packageConfig, presetDefaults)
 * 
 * // 3. Apply user settings for visible categories only (top layer)
 * const finalSettings = mergeUserSettings(withPackageDefaults, userSettings, visibleCategories)
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
 * Applies package defaults for ALL categories, overwriting preset defaults.
 * 
 * This is step 2 of the 3-step priority hierarchy:
 * 1. Preset defaults (base)
 * 2. Package defaults (middle) ← THIS FUNCTION
 * 3. User settings for visible categories (top)
 * 
 * Package defaults apply to ALL categories and serve as the package's standard configuration.
 * User settings will then override only the visible categories in step 3.
 * 
 * @param packageConfig - Package configuration with defaultSettings
 * @param settings - Base settings (usually from preset defaults)
 * @returns Settings with package defaults applied for ALL categories
 */
export function ensureServerDefaults(
  packageConfig: { defaultSettings: PhotoStyleSettings; visibleCategories: CategoryType[] },
  settings: PhotoStyleSettings
): PhotoStyleSettings {
  const result = { ...settings }
  
  // Apply ALL package defaults, overwriting preset defaults
  // This gives the package control over its baseline configuration
  
  if (packageConfig.defaultSettings.pose) {
    result.pose = packageConfig.defaultSettings.pose
  }
  
  if (packageConfig.defaultSettings.shotType) {
    result.shotType = packageConfig.defaultSettings.shotType
  }
  
  if (packageConfig.defaultSettings.background) {
    result.background = packageConfig.defaultSettings.background
  }
  
  if (packageConfig.defaultSettings.branding) {
    result.branding = packageConfig.defaultSettings.branding
  }
  
  if (packageConfig.defaultSettings.clothing) {
    result.clothing = packageConfig.defaultSettings.clothing
  }
  
  if (packageConfig.defaultSettings.clothingColors) {
    result.clothingColors = packageConfig.defaultSettings.clothingColors
  }
  
  if (packageConfig.defaultSettings.expression) {
    result.expression = packageConfig.defaultSettings.expression
  }
  
  if (packageConfig.defaultSettings.lighting) {
    result.lighting = packageConfig.defaultSettings.lighting
  }
  
  return result
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

