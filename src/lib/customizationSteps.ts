import { DEFAULT_CUSTOMIZATION_STEPS } from './generationSteps'

export interface CustomizationStepsMeta {
  /** Number of editable customization steps (user-adjustable). */
  editableSteps: number
  /** Total steps including locked/preset ones (for dot indicator). */
  allSteps: number
  /** Zero-based indices (within allSteps) that should render as locked dots. */
  lockedSteps: number[]
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
  const shift = 1 // selfie occupies index 0

  return {
    current: base.current + shift,
    total: base.total + shift,
    lockedSteps: base.lockedSteps?.map(idx => idx + shift),
    totalWithLocked: base.totalWithLocked ? base.totalWithLocked + shift : base.total + shift,
    currentAllStepsIndex:
      base.currentAllStepsIndex !== undefined ? base.currentAllStepsIndex + shift : undefined,
    visitedEditableSteps: [
      0,
      ...(base.visitedEditableSteps?.map(idx => idx + shift) ?? [])
    ]
  }
}

export function buildSelfieStepIndicator(
  meta: CustomizationStepsMeta,
  options: { selfieComplete: boolean; isDesktop?: boolean }
): StepIndicatorConfig {
  // On desktop, simplify to just 2 steps: selfie + customization (all categories as one)
  if (options.isDesktop) {
    return {
      current: 1,
      total: 2, // selfie + customization
      lockedSteps: undefined,
      totalWithLocked: 2,
      currentAllStepsIndex: 0,
      visitedEditableSteps: options.selfieComplete ? [0] : []
    }
  }

  // Mobile: show detailed breakdown
  const totalEditableSteps = Math.max(meta.editableSteps, 0) + 1 // +1 for selfie selection
  const totalWithLocked = meta.allSteps + 1
  const lockedSteps = meta.lockedSteps.map(idx => idx + 1) // shift for selfie step at index 0

  return {
    current: 1,
    total: totalEditableSteps,
    lockedSteps: lockedSteps.length ? lockedSteps : undefined,
    // Always include totalWithLocked to show all steps (selfie + customization + locked)
    totalWithLocked: totalWithLocked,
    currentAllStepsIndex: 0,
    visitedEditableSteps: options.selfieComplete ? [0] : []
  }
}
