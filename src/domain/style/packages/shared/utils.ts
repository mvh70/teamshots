/**
 * Shared utility functions for style packages
 */

type NestedRecord = Record<string, unknown>

/**
 * Type guard to check if a value is a nested record object
 */
export const isNestedRecord = (value: unknown): value is NestedRecord =>
  typeof value === 'object' && value !== null

/**
 * Sets a value at a nested path within an object using dot notation
 * @param obj - The object to modify
 * @param path - Dot-separated path (e.g., 'subject.pose.arms')
 * @param value - The value to set
 */
export const setPath = (obj: NestedRecord, path: string, value: unknown): void => {
  const segments = path.split('.')
  let current: NestedRecord = obj
  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i]
    const next = current[segment]
    if (!isNestedRecord(next)) {
      const child: NestedRecord = {}
      current[segment] = child
      current = child
    } else {
      current = next
    }
  }
  current[segments[segments.length - 1]] = value
}

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

