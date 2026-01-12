/**
 * Base types for element settings
 *
 * This module provides a wrapper pattern that separates the toggle state
 * (predefined vs user-choice) from the actual element values.
 */

/**
 * Mode determines whether a category is admin-controlled or user-selectable
 * - 'predefined': Admin has locked this to a specific value
 * - 'user-choice': User can choose from available options
 */
export type ElementMode = 'predefined' | 'user-choice'

/**
 * Generic wrapper for element settings
 *
 * @template T - The value type for this element (without 'user-choice')
 *
 * @example
 * // Admin predefined a specific pose
 * { mode: 'predefined', value: { type: 'classic_corporate' } }
 *
 * // User can choose (hasn't selected yet)
 * { mode: 'user-choice', value: undefined }
 *
 * // User can choose (has selected)
 * { mode: 'user-choice', value: { type: 'power_cross' } }
 */
export interface ElementSetting<T> {
  mode: ElementMode
  value?: T
}

/**
 * Type guard: Check if setting is in predefined mode with a value
 */
export function isPredefined<T>(
  setting: ElementSetting<T> | undefined | null
): setting is ElementSetting<T> & { mode: 'predefined'; value: T } {
  return setting?.mode === 'predefined' && setting.value !== undefined
}

/**
 * Type guard: Check if setting is in user-choice mode
 */
export function isUserChoice<T>(
  setting: ElementSetting<T> | undefined | null
): boolean {
  return setting?.mode === 'user-choice'
}

/**
 * Type guard: Check if setting has a value (regardless of mode)
 */
export function hasValue<T>(
  setting: ElementSetting<T> | undefined | null
): setting is ElementSetting<T> & { value: T } {
  return setting?.value !== undefined
}

/**
 * Get the value from a setting, or undefined if not set
 */
export function getValue<T>(
  setting: ElementSetting<T> | undefined | null
): T | undefined {
  return setting?.value
}

/**
 * Create a predefined setting with a value
 */
export function predefined<T>(value: T): ElementSetting<T> {
  return { mode: 'predefined', value }
}

/**
 * Create a user-choice setting (optionally with a selected value)
 */
export function userChoice<T>(value?: T): ElementSetting<T> {
  return { mode: 'user-choice', value }
}
