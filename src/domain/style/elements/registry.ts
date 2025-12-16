/**
 * Element Registry
 *
 * Central registry for all style elements. This allows elements to be
 * fully independent and decouples PhotoStyleSettings from element-specific logic.
 */

import type { PhotoStyleSettings } from '@/types/photo-style'

export interface ElementConfig<T = unknown> {
  /**
   * Get the default value when toggling to "predefined" mode
   */
  getDefaultPredefined: (packageDefaults?: T) => T

  /**
   * Get the default value when toggling to "user-choice" mode
   */
  getDefaultUserChoice: () => T

  /**
   * Deserialize from stored format (optional - not all elements need this)
   */
  deserialize?: (raw: Record<string, unknown>, defaults?: T) => T
}

export type CategoryType = keyof Pick<
  PhotoStyleSettings,
  | 'background'
  | 'branding'
  | 'clothing'
  | 'clothingColors'
  | 'customClothing'
  | 'shotType'
  | 'style'
  | 'expression'
  | 'lighting'
  | 'pose'
>

/**
 * Central element registry mapping category names to their configs
 */
export const elementRegistry: Partial<Record<CategoryType, ElementConfig>> = {}

/**
 * Register an element
 */
export function registerElement<T>(category: CategoryType, config: ElementConfig<T>) {
  elementRegistry[category] = config as ElementConfig
}

/**
 * Get element config by category
 */
export function getElementConfig(category: CategoryType): ElementConfig | undefined {
  return elementRegistry[category]
}
