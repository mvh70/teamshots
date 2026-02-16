import { useMemo } from 'react'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { getUneditedEditableFieldNames } from '@/domain/style/userChoice'
import { getPackageConfig } from '@/domain/style/packages'

type CompletionMode = 'values-only' | 'values-or-visited'

interface UseCustomizationCompletionOptions {
  photoStyleSettings: PhotoStyleSettings
  originalContextSettings?: PhotoStyleSettings
  packageId: string
  stepKeys?: string[]
  editableSteps?: number
  visitedStepKeys?: Set<string>
  visitedMobileStepKeys?: Set<string>
  isMobileViewport: boolean
  completionMode?: CompletionMode
  includeDefaultValues?: boolean
  clothingColorsEditableWhenMissing?: boolean
  acceptedOnVisitKeys?: string[]
  acceptedOnVisitVisitedKeys?: Set<string>
}

interface UseCustomizationCompletionResult {
  uneditedFields: string[]
  hasUneditedFields: boolean
  isCustomizationComplete: boolean
  valueBasedVisitedStepIndices: number[]
  isClothingColorsEditable: boolean
  hasVisitedClothingColorsIfEditable: boolean
}

export function useCustomizationCompletion({
  photoStyleSettings,
  originalContextSettings,
  packageId,
  stepKeys,
  editableSteps = 0,
  visitedStepKeys,
  visitedMobileStepKeys,
  isMobileViewport,
  completionMode = 'values-only',
  includeDefaultValues = true,
  clothingColorsEditableWhenMissing = false,
  acceptedOnVisitKeys = [],
  acceptedOnVisitVisitedKeys
}: UseCustomizationCompletionOptions): UseCustomizationCompletionResult {
  const rawUneditedFields = useMemo(() => {
    return getUneditedEditableFieldNames(
      photoStyleSettings as Record<string, unknown>,
      originalContextSettings as Record<string, unknown> | undefined,
      packageId,
      { includeDefaultValues }
    )
  }, [photoStyleSettings, originalContextSettings, packageId, includeDefaultValues])

  const combinedVisitedStepKeys = useMemo(() => {
    const combined = new Set<string>()
    if (visitedStepKeys) {
      visitedStepKeys.forEach((key) => combined.add(key))
    }
    if (visitedMobileStepKeys) {
      visitedMobileStepKeys.forEach((key) => combined.add(key))
    }
    return combined
  }, [visitedStepKeys, visitedMobileStepKeys])

  const acceptedVisitedStepKeys = useMemo(() => {
    return acceptedOnVisitVisitedKeys ?? combinedVisitedStepKeys
  }, [acceptedOnVisitVisitedKeys, combinedVisitedStepKeys])

  const packageDefaults = useMemo(() => {
    return getPackageConfig(packageId).defaultSettings as Record<string, unknown>
  }, [packageId])

  const activeStepKeySet = useMemo(() => {
    if (!stepKeys || stepKeys.length === 0) return undefined
    return new Set(stepKeys.filter((key): key is string => Boolean(key)))
  }, [stepKeys])

  const scopedRawUneditedFields = useMemo(() => {
    if (!activeStepKeySet) return rawUneditedFields
    return rawUneditedFields.filter((key) => activeStepKeySet.has(key))
  }, [rawUneditedFields, activeStepKeySet])

  const acceptedOnVisitSet = useMemo(() => {
    if (acceptedOnVisitKeys.length === 0) return new Set<string>()
    if (!activeStepKeySet) return new Set(acceptedOnVisitKeys)
    return new Set(acceptedOnVisitKeys.filter((key) => activeStepKeySet.has(key)))
  }, [acceptedOnVisitKeys, activeStepKeySet])

  // Some steps (e.g. clothingColors) can be accepted without modification.
  // Once visited, they should no longer block completion.
  const uneditedFields = useMemo(() => {
    if (acceptedOnVisitSet.size === 0) return scopedRawUneditedFields
    const acceptedSet = acceptedOnVisitSet
    const current = photoStyleSettings as Record<string, unknown>
    const baseline = (originalContextSettings as Record<string, unknown> | undefined) ?? packageDefaults

    const getType = (settings: unknown): string | undefined => {
      if (!settings || typeof settings !== 'object') return undefined
      const value = (settings as { value?: { type?: string } }).value
      return value?.type
    }
    const getSettingValue = (settings: unknown): unknown => {
      if (!settings || typeof settings !== 'object') return undefined
      const record = settings as { value?: unknown }
      if ('value' in record) return record.value
      return settings
    }

    const isSemanticallyUnchanged = (key: string): boolean => {
      if (key === 'pose' || key === 'expression') {
        return getType(current[key]) === getType(baseline[key])
      }

      if (key === 'clothing') {
        return JSON.stringify(getSettingValue(current[key])) === JSON.stringify(getSettingValue(baseline[key]))
      }

      if (key === 'clothingColors') {
        const defaultSetting = packageDefaults['clothingColors'] as { value?: Record<string, unknown>; colors?: Record<string, unknown> } | undefined
        const defaultColors = defaultSetting?.value || defaultSetting?.colors || {}

        const getResolvedColors = (settings: unknown): Record<string, unknown> => {
          const resolved = { ...defaultColors } as Record<string, unknown>
          if (settings && typeof settings === 'object') {
            const settingRecord = settings as { value?: Record<string, unknown>; colors?: Record<string, unknown> }
            const colors = settingRecord.value || settingRecord.colors || {}
            for (const key of ['topLayer', 'baseLayer', 'bottom', 'shoes']) {
              if (colors[key] !== undefined) {
                resolved[key] = colors[key]
              }
            }
          }
          return resolved
        }

        return JSON.stringify(getResolvedColors(current[key])) === JSON.stringify(getResolvedColors(baseline[key]))
      }

      return false
    }

    const unedited = scopedRawUneditedFields.filter((key) => {
      if (!acceptedSet.has(key)) return true
      return !acceptedVisitedStepKeys.has(key)
    })

    for (const key of acceptedSet) {
      if (acceptedVisitedStepKeys.has(key)) continue
      if (!isSemanticallyUnchanged(key)) continue
      if (!unedited.includes(key)) {
        unedited.push(key)
      }
    }

    return unedited
  }, [
    scopedRawUneditedFields,
    acceptedOnVisitSet,
    acceptedVisitedStepKeys,
    photoStyleSettings,
    originalContextSettings,
    packageDefaults
  ])

  const hasUneditedFields = uneditedFields.length > 0

  const valueBasedVisitedStepIndices = useMemo(() => {
    if (!stepKeys || stepKeys.length === 0) return []
    const uneditedSet = new Set(uneditedFields)
    const visited: number[] = []
    stepKeys.forEach((key, index) => {
      if (!uneditedSet.has(key)) {
        visited.push(index)
      }
    })
    return visited
  }, [stepKeys, uneditedFields])

  const allEditableStepsVisited = useMemo(() => {
    if (completionMode !== 'values-or-visited') return false
    const visitedCount = visitedStepKeys?.size ?? 0
    return editableSteps === 0 || visitedCount >= editableSteps
  }, [completionMode, visitedStepKeys, editableSteps])

  const isCustomizationComplete = useMemo(() => {
    if (completionMode === 'values-or-visited') {
      return allEditableStepsVisited || !hasUneditedFields
    }
    return !hasUneditedFields
  }, [completionMode, allEditableStepsVisited, hasUneditedFields])

  const isClothingColorsEditable = useMemo(() => {
    const categorySettings = (originalContextSettings || photoStyleSettings) as Record<string, unknown>
    const clothingColorsSettings = categorySettings['clothingColors'] as { type?: string; mode?: string } | undefined
    if (!clothingColorsSettings) return clothingColorsEditableWhenMissing
    return clothingColorsSettings.mode === 'user-choice' || clothingColorsSettings.type === 'user-choice'
  }, [originalContextSettings, photoStyleSettings, clothingColorsEditableWhenMissing])

  const hasVisitedClothingColorsIfEditable = useMemo(() => {
    if (!isMobileViewport) return true
    return !isClothingColorsEditable || acceptedVisitedStepKeys.has('clothingColors')
  }, [isMobileViewport, isClothingColorsEditable, acceptedVisitedStepKeys])

  return {
    uneditedFields,
    hasUneditedFields,
    isCustomizationComplete,
    valueBasedVisitedStepIndices,
    isClothingColorsEditable,
    hasVisitedClothingColorsIfEditable
  }
}
