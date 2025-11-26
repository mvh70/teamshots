/**
 * Shared utility functions for style packages
 */

export * from './server-defaults'

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

