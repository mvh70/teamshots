/**
 * Type Guard Utilities
 * 
 * Centralized type guards for runtime type checking across the codebase.
 */

/**
 * Checks if a value is a non-null, non-array object (Record)
 * 
 * @param value - Value to check
 * @returns True if value is a Record<string, unknown>
 * 
 * @example
 * ```typescript
 * if (isRecord(data)) {
 *   // TypeScript knows data is Record<string, unknown>
 *   const value = data.someKey
 * }
 * ```
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Checks if a value is a non-empty string
 * 
 * @param value - Value to check
 * @returns True if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Checks if a value is a valid number (not NaN, not Infinity)
 * 
 * @param value - Value to check
 * @returns True if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value)
}

/**
 * Checks if a value is a non-empty array
 * 
 * @param value - Value to check
 * @returns True if value is a non-empty array
 */
export function isNonEmptyArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0
}

/**
 * Type guard for Error objects
 * 
 * @param value - Value to check
 * @returns True if value is an Error instance
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error
}

/**
 * Safely converts unknown value to Record or returns null
 * 
 * @param value - Value to convert
 * @returns Record or null if conversion not possible
 */
export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

/**
 * Safely converts unknown value to string or returns default
 * 
 * @param value - Value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns String value or default
 */
export function asString(value: unknown, defaultValue = ''): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || value === undefined) {
    return defaultValue
  }
  return String(value)
}

/**
 * Safely converts unknown value to number or returns default
 * 
 * @param value - Value to convert
 * @param defaultValue - Default value if conversion fails
 * @returns Number value or default
 */
export function asNumber(value: unknown, defaultValue = 0): number {
  if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && isFinite(parsed)) {
      return parsed
    }
  }
  return defaultValue
}

