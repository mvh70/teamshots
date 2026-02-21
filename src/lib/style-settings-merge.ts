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
  allowMissingPoseExpression = false,
}: {
  settings: PhotoStyleSettingsType
  savedSettings: Partial<PhotoStyleSettingsType> | null
  allowMissingPoseExpression?: boolean
}): PhotoStyleSettingsType {
  if (!savedSettings) {
    return settings
  }

  const merged = { ...settings }

  for (const key of CATEGORIES_TO_MERGE) {
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

    if (savedRestorableValue !== undefined && currentValue && currentIsUserChoice) {
      const shouldNormalizeLegacyChoice =
        (key === 'pose' || key === 'expression') && currentValue.mode === undefined
      ; (merged as Record<string, unknown>)[key] = shouldNormalizeLegacyChoice
        ? { mode: 'user-choice', value: savedRestorableValue }
        : {
            ...currentValue,
            value: savedRestorableValue,
          }
    } else if (
      allowMissingPoseExpression &&
      savedRestorableValue !== undefined &&
      !currentValue &&
      (key === 'pose' || key === 'expression')
    ) {
      ; (merged as Record<string, unknown>)[key] = {
        mode: 'user-choice',
        value: savedRestorableValue,
      }
    }
  }

  return merged
}
