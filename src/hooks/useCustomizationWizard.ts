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

          const wrapped = categorySettings as { mode?: string; type?: string; style?: string }

          // Check for new format first (mode property)
          if ('mode' in wrapped && wrapped.mode !== undefined) {
            return wrapped.mode === 'user-choice'
          }

          // Legacy format fallback
          if (cat.key === 'clothing') {
            return wrapped.style === 'user-choice'
          }
          return wrapped.type === 'user-choice'
        })
        .map(cat => cat.key)
    )
  }, [originalContextSettings, allCategories, readonlyPredefined])

  // Consolidate editable/locked category filtering into single memo
  // Avoids iterating allCategories twice
  const { currentEditableCategories, currentLockedCategories } = useMemo(() => {
    if (showToggles) {
      return { currentEditableCategories: [], currentLockedCategories: [] }
    }
    const editable: CategoryConfig[] = []
    const locked: CategoryConfig[] = []
    for (const cat of allCategories) {
      if (wasInitiallyEditable.has(cat.key)) {
        editable.push(cat)
      } else {
        locked.push(cat)
      }
    }
    return { currentEditableCategories: editable, currentLockedCategories: locked }
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

    // Extract step names for tooltips (editable steps only, for dock dots)
    const stepNames = editableNumberedSteps.map(step => {
      return step.category?.label ?? ''
    })

    // Extract step keys for visited step lookup (editable steps only)
    const stepKeys = editableNumberedSteps.map(step => {
      return step.category?.key ?? ''
    })

    return {
      editableSteps: editableNumberedSteps.length,
      allSteps: allNumberedSteps.length,
      lockedSteps: lockedStepIndices,
      stepNames,
      stepKeys
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

