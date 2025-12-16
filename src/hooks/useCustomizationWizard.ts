import { useMemo } from 'react'
import {
  PhotoStyleSettings as PhotoStyleSettingsType,
  CategoryType
} from '@/types/photo-style'
import { MobileStep } from '@/components/customization/PhotoStyleSettings'
import { CustomizationStepsMeta } from '@/lib/customizationSteps'
import type { ElementMetadata as CategoryConfig } from '@/domain/style/elements'

type UseCustomizationWizardProps = {
  value: PhotoStyleSettingsType
  originalContextSettings?: PhotoStyleSettingsType
  packageId: string
  showToggles: boolean
  readonlyPredefined: boolean
  mobileExtraSteps?: MobileStep['custom'][]
  allCategories: CategoryConfig[]
}

export function useCustomizationWizard({
  originalContextSettings,
  showToggles,
  readonlyPredefined,
  mobileExtraSteps,
  allCategories
}: UseCustomizationWizardProps) {
  
  const wasInitiallyEditable = useMemo(() => {
    if (!readonlyPredefined) {
      return new Set(allCategories.map(cat => cat.key))
    }

    const initialSettings = originalContextSettings
    if (!initialSettings) return new Set<CategoryType>()

    return new Set(
      allCategories
        .filter(cat => {
          const categorySettings = (initialSettings as Record<string, unknown>)[cat.key]
          if (!categorySettings) return false
          
          if (cat.key === 'clothing') {
            return (categorySettings as { style?: string }).style === 'user-choice'
          }
          return (categorySettings as { type?: string }).type === 'user-choice'
        })
        .map(cat => cat.key)
    )
  }, [originalContextSettings, allCategories, readonlyPredefined])

  const currentEditableCategories = useMemo(() => {
    if (showToggles) return []
    return allCategories.filter(cat => wasInitiallyEditable.has(cat.key))
  }, [showToggles, allCategories, wasInitiallyEditable])
  
  const currentLockedCategories = useMemo(() => {
    if (showToggles) return []
    return allCategories.filter(cat => !wasInitiallyEditable.has(cat.key))
  }, [showToggles, allCategories, wasInitiallyEditable])

  // Construct mobile steps
  const mobileSteps = useMemo<MobileStep[]>(() => {
    if (showToggles) return []
    const steps: MobileStep[] = []

    // Custom steps (e.g., selfie selection)
    if (mobileExtraSteps?.length) {
      mobileExtraSteps.forEach(step => {
        steps.push({ type: 'custom', custom: step })
      })
    }

    // Style customization categories (editable)
    currentEditableCategories.forEach(cat => {
      steps.push({
        category: cat,
        type: 'editable'
      })
    })

    // Locked categories - ALWAYS include them on mobile
    // This fixes the issue where logged-in users with no/few editable fields saw an empty or partial list
    if (currentLockedCategories.length > 0) {
      currentLockedCategories.forEach(cat => {
        steps.push({
          category: cat,
          type: 'locked'
        })
      })
    }

    return steps
  }, [showToggles, currentEditableCategories, currentLockedCategories, mobileExtraSteps])

  const customizationStepMeta = useMemo<CustomizationStepsMeta>(() => {
    const allNumberedSteps = mobileSteps.filter(step => step.type !== 'intro' && step.type !== 'selfie-tips')
    const editableNumberedSteps = allNumberedSteps.filter(step => step.type === 'editable')
    const lockedStepIndices = allNumberedSteps
      .map((step, idx) => step.type === 'locked' ? idx : -1)
      .filter(idx => idx >= 0)

    return {
      editableSteps: editableNumberedSteps.length,
      allSteps: allNumberedSteps.length,
      lockedSteps: lockedStepIndices
    }
  }, [mobileSteps])

  return {
    mobileSteps,
    currentEditableCategories,
    currentLockedCategories,
    customizationStepMeta,
    isCategoryEditable: (key: CategoryType) => wasInitiallyEditable.has(key)
  }
}

