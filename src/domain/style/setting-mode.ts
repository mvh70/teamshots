/**
 * Determine the mode of a style setting for a given category.
 *
 * Handles the three setting formats used across the codebase:
 * - `customClothing`: uses a flat `{ type }` field
 * - New format: uses `{ mode }` wrapper
 * - Legacy format: uses `{ style }` (clothing) or `{ type }` (others)
 */
export function getSettingMode(category: string, settings: unknown): 'predefined' | 'user-choice' | null {
  if (!settings) return null

  // CustomClothing uses a different pattern (type field directly, not wrapped)
  if (category === 'customClothing') {
    const type = (settings as { type?: string }).type
    if (type === 'user-choice') return 'user-choice'
    if (type === 'predefined') return 'predefined'
    return null
  }

  // All other categories use the ElementSetting wrapper pattern
  // Check for new format first (mode property)
  const wrapped = settings as { mode?: string; type?: string; style?: string }
  if ('mode' in wrapped && wrapped.mode !== undefined) {
    if (wrapped.mode === 'user-choice') return 'user-choice'
    if (wrapped.mode === 'predefined') return 'predefined'
    return null
  }

  // Legacy format fallback
  if (category === 'clothing') {
    return wrapped.style === 'user-choice' ? 'user-choice' : 'predefined'
  }
  return wrapped.type === 'user-choice' ? 'user-choice' : 'predefined'
}
