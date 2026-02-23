import type { PhotoStyleSettings as PhotoStyleSettingsType } from '@/types/photo-style'

type StyleFieldValue = {
  type?: string
  style?: string
  mode?: string
  value?: unknown
}

const CATEGORIES_TO_MERGE = [
  'background',
  'clothing',
  'clothingColors',
  'shotType',
  'branding',
  'expression',
  'pose',
  'customClothing',
] as const

export function mergeSavedUserChoiceStyleSettings({
  settings,
  savedSettings,
}: {
  settings: PhotoStyleSettingsType
  savedSettings: Partial<PhotoStyleSettingsType> | null
}): PhotoStyleSettingsType {
  if (!savedSettings) {
    return settings
  }

  const merged = { ...settings }

  for (const key of CATEGORIES_TO_MERGE) {
    const settingHasKey = Object.prototype.hasOwnProperty.call(settings, key)
    const currentValue = settings[key] as StyleFieldValue | undefined
    const savedValue = savedSettings[key] as StyleFieldValue | undefined

    const savedRestorableValue = (() => {
      if (!savedValue) return undefined
      if (savedValue.value !== undefined) return savedValue.value
      if ((key === 'pose' || key === 'expression') && savedValue.type && savedValue.type !== 'user-choice' && savedValue.type !== 'predefined') {
        return { type: savedValue.type }
      }
      return undefined
    })()

    const currentIsUserChoice =
      currentValue?.mode === 'user-choice' ||
      currentValue?.type === 'user-choice' ||
      currentValue?.style === 'user-choice'

    if (savedRestorableValue === undefined || !settingHasKey) {
      continue
    }

    if (currentValue) {
      if (!currentIsUserChoice) {
        continue
      }

      const shouldNormalizeLegacyChoice =
        (key === 'pose' || key === 'expression') && currentValue.mode === undefined
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
