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
      // Type assertion needed because we're dynamically assigning different setting types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[field] = userSettings[field]
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

