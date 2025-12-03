import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { 
  PhotoStyleSettings, 
  CategoryType, 
  DEFAULT_PHOTO_STYLE_SETTINGS 
} from '@/types/photo-style'
import { getPackageConfig } from '@/domain/style/packages'
import { 
  buildCustomizationStepIndicatorWithSelfie, 
  CustomizationStepsMeta,
  StepIndicatorConfig 
} from '@/lib/customizationSteps'
import { useGenerationFlowState } from '@/hooks/useGenerationFlowState'
import { useSwipeEnabled } from '@/hooks/useSwipeEnabled'
import { 
  PHOTO_STYLE_CATEGORIES, 
  USER_STYLE_CATEGORIES, 
  CategoryConfig 
} from '@/components/customization/categories'
import { ensureVisibleCategories } from '@/domain/style/utils'

export type MobileCustomStep = {
  id: string
  title: string
  description?: string
  badgeLabel?: string
  badgeVariant?: 'info' | 'success' | 'warning'
  content: React.ReactNode
  isComplete?: boolean
  noBorder?: boolean
}

export type MobileStep = {
  type: 'intro' | 'selfie-tips' | 'custom' | 'editable' | 'locked'
  category?: CategoryConfig
  custom?: MobileCustomStep
}

export interface UseCustomizationWizardOptions {
  packageId?: string
  initialSettings: PhotoStyleSettings
  originalSettings?: PhotoStyleSettings
  mobileExtraSteps?: MobileCustomStep[]
  onStepMetaChange?: (meta: CustomizationStepsMeta) => void
  onStepChange?: (step: MobileStep | null, index: number) => void
  onSwipeBack?: () => void
  visitedSteps?: Set<string> // For invited flow which manages visited steps externally
  setVisitedSteps?: (steps: Set<string>) => void // For invited flow
}

export interface UseCustomizationWizardResult {
  mobileSteps: MobileStep[]
  activeMobileStep: number
  stepIndicatorProps?: StepIndicatorConfig
  canGenerate: boolean
  visitedEditableSteps: Set<number>
  
  // Handlers
  nextStep: () => void
  prevStep: () => void
  directStep: (index: number) => void
  onSwipeBack?: () => void
  
  // Helpers
  isCategoryPredefined: (category: CategoryType) => boolean
  currentEditableCategories: CategoryConfig[]
  currentLockedCategories: CategoryConfig[]
}

export function useCustomizationWizard({
  packageId,
  initialSettings,
  originalSettings,
  mobileExtraSteps,
  onStepMetaChange,
  onStepChange,
  onSwipeBack,
  visitedSteps: externalVisitedSteps,
  setVisitedSteps: setExternalVisitedSteps
}: UseCustomizationWizardOptions): UseCustomizationWizardResult {
  const isSwipeEnabled = useSwipeEnabled()
  const pkg = getPackageConfig(packageId)
  
  const allCategories = useMemo(() => [
    ...PHOTO_STYLE_CATEGORIES, 
    ...USER_STYLE_CATEGORIES
  ], [])

  // State
  const [activeMobileStep, setActiveMobileStep] = useState(0)
  
  // Visited steps management (internal vs external)
  const { visitedSteps: persistedVisitedSteps, setVisitedSteps: setPersistentVisitedSteps } = useGenerationFlowState()
  
  // Initialize from persisted state if not using external management
  const [internalVisitedSteps, setInternalVisitedSteps] = useState<Set<number>>(() => 
    externalVisitedSteps ? new Set() : new Set(persistedVisitedSteps)
  )

  // Capture initial settings ref
  const initialSettingsRef = useRef<PhotoStyleSettings | undefined>(undefined)
  if (initialSettingsRef.current === undefined) {
    initialSettingsRef.current = initialSettings
  }

  // Determine which categories started as user-choice
  const wasInitiallyEditable = useMemo(() => {
    const base = (originalSettings || initialSettingsRef.current) ?? undefined
    const fallback = initialSettingsRef.current

    const currentPkg = getPackageConfig(packageId)
    
    // Use default fallback if visibleCategories is empty (defensive)
    const visibleCats = ensureVisibleCategories(currentPkg)

    const resolveCategorySettings = (categoryKey: CategoryType) => {
      const baseSettings = base ? (base as Record<string, unknown>)[categoryKey] : undefined
      if (baseSettings) return baseSettings
      return fallback ? (fallback as Record<string, unknown>)[categoryKey] : undefined
    }

    return new Set(
      visibleCats
        .filter(catKey => {
          const categorySettings = resolveCategorySettings(catKey)
          if (!categorySettings) return false
          if (catKey === 'clothing') {
            return (categorySettings as { style?: string }).style === 'user-choice'
          }
          return (categorySettings as { type?: string }).type === 'user-choice'
        })
    )
  }, [originalSettings, packageId])

  // Split categories
  const currentEditableCategories = useMemo(() => {
    return allCategories.filter(cat => wasInitiallyEditable.has(cat.key))
  }, [allCategories, wasInitiallyEditable])
  
  const currentLockedCategories = useMemo(() => {
    // Only include visible categories that are NOT in editable set
    const currentPkg = getPackageConfig(packageId)
    const visibleCats = new Set(ensureVisibleCategories(currentPkg))
    
    return allCategories.filter(cat => 
      visibleCats.has(cat.key) && !wasInitiallyEditable.has(cat.key)
    )
  }, [allCategories, wasInitiallyEditable, packageId])

  // Build step list
  const mobileSteps = useMemo<MobileStep[]>(() => {
    const steps: MobileStep[] = []

    // 1. Custom steps (selfie, etc)
    if (mobileExtraSteps?.length) {
      mobileExtraSteps.forEach(step => {
        steps.push({ type: 'custom', custom: step })
      })
    }

    // 2. Editable categories
    currentEditableCategories.forEach(cat => {
      steps.push({ category: cat, type: 'editable' })
    })

    // 3. Locked categories (ALWAYS included now)
    currentLockedCategories.forEach(cat => {
      steps.push({ category: cat, type: 'locked' })
    })

    return steps
  }, [mobileExtraSteps, currentEditableCategories, currentLockedCategories])

  // Derived step info
  const totalMobileSteps = mobileSteps.length
  const currentMobileStep = mobileSteps[activeMobileStep]

  // Numbered steps logic (exclude intro)
  const allNumberedSteps = useMemo(() => 
    mobileSteps.filter(step => step.type !== 'intro' && step.type !== 'selfie-tips'),
  [mobileSteps])

  const editableNumberedSteps = useMemo(() => 
    allNumberedSteps.filter(step => step.type === 'editable'),
  [allNumberedSteps])

  const totalEditableSteps = editableNumberedSteps.length
  const totalAllSteps = allNumberedSteps.length

  const lockedStepIndices = useMemo(() => 
    allNumberedSteps
      .map((step, idx) => step.type === 'locked' ? idx : -1)
      .filter(idx => idx >= 0),
  [allNumberedSteps])

  // Meta callback
  const customizationStepMeta = useMemo<CustomizationStepsMeta>(() => ({
    editableSteps: totalEditableSteps,
    allSteps: totalAllSteps,
    lockedSteps: lockedStepIndices
  }), [totalEditableSteps, totalAllSteps, lockedStepIndices])

  useEffect(() => {
    onStepMetaChange?.(customizationStepMeta)
  }, [onStepMetaChange, customizationStepMeta])

  // Current step index within all numbered steps
  const currentAllStepsIndex = useMemo(() => {
    if (!currentMobileStep || currentMobileStep.type === 'intro' || currentMobileStep.type === 'selfie-tips') {
      return -1
    }
    
    return allNumberedSteps.findIndex(step => {
      if (step.type === 'custom' && currentMobileStep.type === 'custom') {
        return step.custom?.id === currentMobileStep.custom?.id
      }
      if (step.category && currentMobileStep.category) {
        return step.category.key === currentMobileStep.category.key
      }
      return false
    })
  }, [currentMobileStep, allNumberedSteps])

  // Visit tracking
  useEffect(() => {
    if (currentAllStepsIndex >= 0 && currentMobileStep?.type === 'editable') {
      setInternalVisitedSteps(prev => {
        if (prev.has(currentAllStepsIndex)) return prev
        const next = new Set(prev)
        next.add(currentAllStepsIndex)
        return next
      })
    }
  }, [currentAllStepsIndex, currentMobileStep?.type])

  // Persist internal visits
  useEffect(() => {
    if (!externalVisitedSteps) {
      setPersistentVisitedSteps(Array.from(internalVisitedSteps))
    }
  }, [internalVisitedSteps, setPersistentVisitedSteps, externalVisitedSteps])

  // Indicator props
  const currentNumberedStepIndex = useMemo(() => {
    if (currentAllStepsIndex < 0) return 0
    
    // Logic for locked steps to show last completed editable step
    if (currentMobileStep?.type === 'locked') {
      let lastEditableIndex = -1
      for (let i = currentAllStepsIndex - 1; i >= 0; i--) {
        const numberedStep = allNumberedSteps[i]
        if (numberedStep?.type === 'editable') {
          // Find index in editable array
          const idx = editableNumberedSteps.indexOf(numberedStep)
          if (idx >= 0) {
            lastEditableIndex = idx
            break
          }
        }
      }
      return lastEditableIndex >= 0 ? lastEditableIndex + 1 : 0
    }
    
    const idx = editableNumberedSteps.findIndex(s => s === currentMobileStep)
    return idx >= 0 ? idx + 1 : 0
  }, [currentAllStepsIndex, currentMobileStep, allNumberedSteps, editableNumberedSteps])

  const stepIndicatorProps = useMemo(() => {
    if (!currentMobileStep || currentMobileStep.type === 'intro' || currentMobileStep.type === 'selfie-tips' || totalEditableSteps === 0) {
      return undefined
    }
    
    const currentEditableIndex = (currentNumberedStepIndex > 0 ? currentNumberedStepIndex : 1) - 1
    return buildCustomizationStepIndicatorWithSelfie(customizationStepMeta, {
      currentEditableIndex,
      currentAllStepsIndex: currentAllStepsIndex >= 0 ? currentAllStepsIndex : undefined,
      visitedEditableSteps: Array.from(internalVisitedSteps)
    })
  }, [currentMobileStep, totalEditableSteps, currentNumberedStepIndex, customizationStepMeta, currentAllStepsIndex, internalVisitedSteps])

  // Can Generate Calculation
  // User must have visited ALL editable steps
  const canGenerate = useMemo(() => {
    // If no editable steps, we can generate (assuming locked steps don't need visitation)
    if (totalEditableSteps === 0) return true
    
    // Check if all editable indices are in visited set
    // Map editable steps to their allNumberedSteps index
    const editableIndices = editableNumberedSteps.map(step => allNumberedSteps.indexOf(step))
    
    return editableIndices.every(idx => internalVisitedSteps.has(idx))
  }, [totalEditableSteps, editableNumberedSteps, allNumberedSteps, internalVisitedSteps])

  // Handlers
  const handleNextStep = useCallback(() => {
    setActiveMobileStep(prev => {
      if (mobileSteps.length === 0) return 0
      return Math.min(prev + 1, mobileSteps.length - 1)
    })
  }, [mobileSteps.length])

  const handlePrevStep = useCallback(() => {
    setActiveMobileStep(prev => {
      if (prev === 0 && onSwipeBack) {
        onSwipeBack()
        return prev
      }
      return Math.max(prev - 1, 0)
    })
  }, [onSwipeBack])

  const handleDirectStepChange = useCallback((index: number) => {
    // Need to map indicator index back to mobileSteps index if needed
    // Assuming index passed here is from step indicator which usually maps 1:1 with numbered steps
    // Implementation detail: the dot click handler in the UI needs to handle the mapping
    // For simplicity, we'll assume the UI component handles the mapping before calling this
    setActiveMobileStep(prev => {
      if (index < 0 || index >= mobileSteps.length) return prev
      return index
    })
  }, [mobileSteps.length])

  // Notify parent of step changes
  const prevStepRef = useRef<{type: string|null, id: string|null, index: number}>({type:null, id:null, index:-1})
  useEffect(() => {
    if (onStepChange) {
      const currentType = currentMobileStep?.type ?? null
      const currentId = currentMobileStep?.custom?.id ?? currentMobileStep?.category?.key ?? null
      const prev = prevStepRef.current
      
      if (prev.type !== currentType || prev.id !== currentId || prev.index !== activeMobileStep) {
        prevStepRef.current = { type: currentType, id: currentId, index: activeMobileStep }
        onStepChange(currentMobileStep ?? null, activeMobileStep)
      }
    }
  }, [currentMobileStep, activeMobileStep, onStepChange])

  // Helper for render
  const isCategoryPredefined = useCallback((category: CategoryType) => {
    // If we have original settings, check if it was user-choice there
    if (originalSettings) {
      const orig = (originalSettings as Record<string, unknown>)[category]
      if (!orig) return false // Assume editable if missing? Or locked? Logic in component used fallback.
      // We used wasInitiallyEditable logic above which is more robust.
      // Simpler: if it's in currentEditableCategories, it's NOT predefined (it's editable)
      // if it's in currentLockedCategories, it IS predefined.
      return !wasInitiallyEditable.has(category)
    }
    // Fallback: check current value type? 
    // Actually, wasInitiallyEditable is the source of truth for the wizard layout.
    return !wasInitiallyEditable.has(category)
  }, [originalSettings, wasInitiallyEditable])

  return {
    mobileSteps,
    activeMobileStep,
    stepIndicatorProps,
    canGenerate,
    visitedEditableSteps: internalVisitedSteps,
    nextStep: handleNextStep,
    prevStep: handlePrevStep,
    directStep: handleDirectStepChange,
    onSwipeBack: onSwipeBack, // Pass through from props if needed, or expose internal wrapper if we add logic
    isCategoryPredefined,
    currentEditableCategories,
    currentLockedCategories
  }
}

