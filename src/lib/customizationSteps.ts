import { DEFAULT_CUSTOMIZATION_STEPS, FLOW_PREFIX_STEPS } from './generationSteps'

export interface CustomizationStepsMeta {
  /** Number of editable customization steps (user-adjustable). */
  editableSteps: number
  /** Total steps including locked/preset ones (for dot indicator). */
  allSteps: number
  /** Zero-based indices (within allSteps) that should render as locked dots. */
  lockedSteps: number[]
  /** Step names for tooltips, in order matching allSteps indices. */
  stepNames?: string[]
  /** Step category keys (e.g., 'pose', 'clothingColors'), in order matching allSteps indices. */
  stepKeys?: string[]
}

export const DEFAULT_CUSTOMIZATION_STEPS_META: CustomizationStepsMeta = {
  editableSteps: DEFAULT_CUSTOMIZATION_STEPS,
  allSteps: DEFAULT_CUSTOMIZATION_STEPS,
  lockedSteps: []
}

export interface CustomizationStepIndicatorOptions {
  /** Current editable step index (0-indexed). */
  currentEditableIndex: number
  /** Current index within all steps (locked + editable). */
  currentAllStepsIndex?: number
  /** Visited editable steps (indices in all steps array). */
  visitedEditableSteps?: number[]
}

export interface StepIndicatorConfig {
  current: number
  total: number
  lockedSteps?: number[]
  totalWithLocked?: number
  currentAllStepsIndex?: number
  visitedEditableSteps?: number[]
}

export interface NavigationStepColors {
  lockedSteps?: number[]
  visitedEditableSteps?: number[]
}

export interface FlowStepNavigationConfig {
  stepperTotalDots: number
  navCurrentIndex: number
  navigationStepColors?: NavigationStepColors
}

interface UnifiedSelfieStepIndicatorOptions {
  selfieComplete: boolean
  beautificationComplete?: boolean
  isDesktop?: boolean
  visitedCustomizationSteps?: number[]
  currentStep?: 'selfies' | 'beautification' | 'customization'
  hideCurrentStep?: boolean
}

interface UnifiedStepIndicatorResult {
  indicator: StepIndicatorConfig
  stepperTotalDots: number
  navCurrentIndex: number
  navigationStepColors?: NavigationStepColors
}

export function buildCustomizationStepIndicator(
  meta: CustomizationStepsMeta,
  options: CustomizationStepIndicatorOptions
): StepIndicatorConfig {
  const current = Math.max(1, options.currentEditableIndex + 1)
  return {
    current,
    total: Math.max(meta.editableSteps, 1),
    lockedSteps: meta.lockedSteps.length ? meta.lockedSteps : undefined,
    totalWithLocked: meta.allSteps > meta.editableSteps ? meta.allSteps : undefined,
    currentAllStepsIndex: options.currentAllStepsIndex,
    visitedEditableSteps: options.visitedEditableSteps
  }
}

export function buildCustomizationStepIndicatorWithSelfie(
  meta: CustomizationStepsMeta,
  options: CustomizationStepIndicatorOptions
): StepIndicatorConfig {
  const base = buildCustomizationStepIndicator(meta, options)
  const shift = FLOW_PREFIX_STEPS // selfie + beautification occupy indices 0-1

  return {
    current: base.current + shift,
    total: base.total + shift,
    lockedSteps: base.lockedSteps?.map(idx => idx + shift),
    totalWithLocked: base.totalWithLocked ? base.totalWithLocked + shift : base.total + shift,
    currentAllStepsIndex:
      base.currentAllStepsIndex !== undefined ? base.currentAllStepsIndex + shift : undefined,
    visitedEditableSteps: [
      ...Array.from({ length: shift }, (_, idx) => idx),
      ...(base.visitedEditableSteps?.map(idx => idx + shift) ?? [])
    ]
  }
}

export function buildSelfieStepIndicator(
  meta: CustomizationStepsMeta,
  options: {
    selfieComplete: boolean
    beautificationComplete?: boolean
    isDesktop?: boolean
    visitedCustomizationSteps?: number[]
    currentStep?: 'selfies' | 'beautification' | 'customization'
  }
): StepIndicatorConfig {
  const beautificationComplete = options.beautificationComplete ?? false
  const currentStep = options.currentStep ?? 'selfies'
  const currentPrefixIndex = currentStep === 'beautification' ? 1 : currentStep === 'customization' ? FLOW_PREFIX_STEPS : 0

  // Build visited steps array: selfie (0), beautification (1), then customization steps (shifted)
  const visitedSteps: number[] = []
  if (options.selfieComplete) {
    visitedSteps.push(0)
  }
  if (beautificationComplete) {
    visitedSteps.push(1)
  }
  // Add visited customization steps (shifted by prefix steps)
  if (options.visitedCustomizationSteps) {
    for (const idx of options.visitedCustomizationSteps) {
      visitedSteps.push(idx + FLOW_PREFIX_STEPS)
    }
  }

  // On desktop, simplify to 3 steps: selfie + beautification + customization
  if (options.isDesktop) {
    const desktopVisited: number[] = []
    if (options.selfieComplete) desktopVisited.push(0)
    if (beautificationComplete) desktopVisited.push(1)
    if (options.visitedCustomizationSteps && options.visitedCustomizationSteps.length > 0) {
      desktopVisited.push(2)
    }
    return {
      current: currentPrefixIndex + 1,
      total: 3,
      lockedSteps: undefined,
      totalWithLocked: 3,
      currentAllStepsIndex: currentPrefixIndex,
      visitedEditableSteps: desktopVisited
    }
  }

  // Mobile: selfie + beautification + detailed customization breakdown
  const totalEditableSteps = Math.max(meta.editableSteps, 0) + FLOW_PREFIX_STEPS
  const totalWithLocked = meta.allSteps + FLOW_PREFIX_STEPS
  const lockedSteps = meta.lockedSteps.map(idx => idx + FLOW_PREFIX_STEPS)

  return {
    current: currentPrefixIndex + 1,
    total: totalEditableSteps,
    lockedSteps: lockedSteps.length ? lockedSteps : undefined,
    totalWithLocked,
    currentAllStepsIndex: currentPrefixIndex,
    visitedEditableSteps: visitedSteps
  }
}

export function getNavigationStepColors(indicator: StepIndicatorConfig): NavigationStepColors | undefined {
  if (!indicator.lockedSteps && !indicator.visitedEditableSteps) {
    return undefined
  }

  return {
    lockedSteps: indicator.lockedSteps,
    visitedEditableSteps: indicator.visitedEditableSteps,
  }
}

export function buildFlowStepNavigation(
  indicator: StepIndicatorConfig,
  options?: { hideCurrentStep?: boolean }
): FlowStepNavigationConfig {
  return {
    stepperTotalDots: indicator.totalWithLocked ?? indicator.total,
    navCurrentIndex: options?.hideCurrentStep
      ? -1
      : indicator.currentAllStepsIndex ?? Math.max(0, indicator.current - 1),
    navigationStepColors: getNavigationStepColors(indicator),
  }
}

export function buildNormalStepIndicator(
  meta: CustomizationStepsMeta,
  options: UnifiedSelfieStepIndicatorOptions
): UnifiedStepIndicatorResult {
  const indicator = buildSelfieStepIndicator(meta, {
    selfieComplete: options.selfieComplete,
    beautificationComplete: options.beautificationComplete,
    isDesktop: options.isDesktop,
    visitedCustomizationSteps: options.visitedCustomizationSteps,
    currentStep: options.currentStep,
  })

  return {
    indicator,
    ...buildFlowStepNavigation(indicator, { hideCurrentStep: options.hideCurrentStep }),
  }
}

export function isCustomizationComplete(
  meta: CustomizationStepsMeta,
  visitedStepIndexes: number[]
): boolean {
  return meta.editableSteps === 0 || visitedStepIndexes.length >= meta.editableSteps
}
