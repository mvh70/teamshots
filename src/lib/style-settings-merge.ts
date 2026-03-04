import type { PhotoStyleSettings as PhotoStyleSettingsType, CategoryType } from '@/types/photo-style'
import { NON_VISIBLE_OVERRIDABLE_SETTING_FIELDS } from '@/domain/style/style-setting-allowlists'
import { getElementConfig, type CategoryType as RegistryCategoryType } from '@/domain/style/elements/registry'
import '@/domain/style/elements/init-registry'

type StyleFieldValue = {
  type?: string
  style?: string
  mode?: string
  value?: unknown
}

type MergeableSettingKey = Extract<keyof PhotoStyleSettingsType, string>

const LEGACY_DIRECT_TYPE_KEYS = new Set<MergeableSettingKey>(['pose', 'expression'])
const REGISTRY_CATEGORY_KEYS = new Set<RegistryCategoryType>([
  'background',
  'branding',
  'clothing',
  'clothingColors',
  'customClothing',
  'shotType',
  'style',
  'expression',
  'industry',
  'lighting',
  'pose',
])

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSettingLike(value: unknown): value is StyleFieldValue {
  if (!isObject(value)) return false
  return 'mode' in value || 'value' in value || 'type' in value || 'style' in value
}

function extractSavedRestorableValue(
  key: MergeableSettingKey,
  savedValue: StyleFieldValue | undefined
): unknown {
  if (!savedValue) return undefined
  if (savedValue.value !== undefined) return savedValue.value

  // Legacy format support (e.g. { type: 'classic_corporate' } for pose/expression)
  if (
    LEGACY_DIRECT_TYPE_KEYS.has(key) &&
    savedValue.type &&
    savedValue.type !== 'user-choice' &&
    savedValue.type !== 'predefined'
  ) {
    return { type: savedValue.type }
  }
  return undefined
}

function isUserChoiceSetting(value: StyleFieldValue | undefined): boolean {
  if (!value) return false
  return (
    value.mode === 'user-choice' ||
    value.type === 'user-choice' ||
    value.style === 'user-choice'
  )
}

function mergePredefinedSetting(
  key: MergeableSettingKey,
  currentValue: StyleFieldValue,
  savedRestorableValue: unknown
): StyleFieldValue | undefined {
  if (!REGISTRY_CATEGORY_KEYS.has(key as RegistryCategoryType)) return undefined

  const elementConfig = getElementConfig(key as RegistryCategoryType)
  if (!elementConfig?.mergePredefinedFromSession) return undefined

  const merged = elementConfig.mergePredefinedFromSession({
    currentSetting: currentValue,
    savedValue: savedRestorableValue,
  })

  return isSettingLike(merged) ? merged : undefined
}

export function mergeSavedUserChoiceStyleSettings({
  settings,
  savedSettings,
  visibleCategories,
}: {
  settings: PhotoStyleSettingsType
  savedSettings: Partial<PhotoStyleSettingsType> | null
  visibleCategories?: readonly CategoryType[]
}): PhotoStyleSettingsType {
  if (!savedSettings) {
    return settings
  }

  // Only merge categories the package exposes (+ explicitly overridable hidden fields).
  const allowedSet = visibleCategories
    ? new Set<string>([...visibleCategories, ...NON_VISIBLE_OVERRIDABLE_SETTING_FIELDS])
    : null

  const merged = { ...settings }
  const keysToCheck: string[] = allowedSet
    ? Array.from(allowedSet)
    : Array.from(
        new Set<string>([
          ...Object.keys(settings as Record<string, unknown>),
          ...Object.keys(savedSettings as Record<string, unknown>),
        ])
      )

  for (const rawKey of keysToCheck) {
    const key = rawKey as MergeableSettingKey

    const settingHasKey = Object.prototype.hasOwnProperty.call(settings, key)
    const rawCurrentValue = settings[key]
    const rawSavedValue = savedSettings[key]
    const currentValue = isSettingLike(rawCurrentValue) ? rawCurrentValue : undefined
    const savedValue = isSettingLike(rawSavedValue) ? rawSavedValue : undefined

    // Skip non-setting fields (e.g. presetId/aspectRatio) and unknown primitives.
    if (!currentValue && !savedValue) {
      continue
    }

    const savedRestorableValue = extractSavedRestorableValue(key, savedValue)
    const currentIsUserChoice = isUserChoiceSetting(currentValue)

    // Non-visible overridable fields (e.g. beautification) can be injected from session
    // storage even when the current settings don't have the key — legacy contexts may
    // predate the field's existence.
    const isNonVisibleOverridable = (NON_VISIBLE_OVERRIDABLE_SETTING_FIELDS as readonly string[]).includes(key)
    if (savedRestorableValue === undefined || (!settingHasKey && !isNonVisibleOverridable)) {
      continue
    }

    if (currentValue) {
      if (!currentIsUserChoice) {
        const predefinedMerge = mergePredefinedSetting(key, currentValue, savedRestorableValue)
        if (predefinedMerge) {
          ;(merged as Record<string, unknown>)[key] = predefinedMerge
        }
        continue
      }

      const shouldNormalizeLegacyChoice =
        LEGACY_DIRECT_TYPE_KEYS.has(key) && currentValue.mode === undefined
      ; (merged as Record<string, unknown>)[key] = shouldNormalizeLegacyChoice
        ? { mode: 'user-choice', value: savedRestorableValue }
        : {
            ...currentValue,
            value: savedRestorableValue,
          }
      continue
    }

    ; (merged as Record<string, unknown>)[key] = {
      mode: 'user-choice',
      value: savedRestorableValue,
    }
  }

  return merged
}
