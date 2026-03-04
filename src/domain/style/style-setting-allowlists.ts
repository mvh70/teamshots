import type { PhotoStyleSettings } from '@/types/photo-style'

/**
 * Style keys that may be provided by clients even when not listed in package visibleCategories.
 * These are validated separately from visible element categories.
 */
export const NON_VISIBLE_OVERRIDABLE_REQUEST_KEYS = [
  'packageId',
  'presetId',
  'aspectRatio',
  'subjectCount',
  'usageContext',
  'style',
  'beautification',
] as const

/**
 * Settings fields that should be merged from user settings even when non-visible in package UI.
 */
export const NON_VISIBLE_OVERRIDABLE_SETTING_FIELDS: Array<keyof PhotoStyleSettings> = [
  'beautification',
]

export function buildAllowedStyleRequestKeys(visibleCategories: readonly string[]): Set<string> {
  return new Set([...visibleCategories, ...NON_VISIBLE_OVERRIDABLE_REQUEST_KEYS])
}
