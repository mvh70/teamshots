
export const SELFIE_STEP_INDEX = 1
export const DEFAULT_CUSTOMIZATION_STEPS = 2

/**
 * Compute total steps in the generation flow.
 * @param customizationSteps number of individual customization screens
 */
export function getTotalSteps(customizationSteps: number): number {
  return customizationSteps + SELFIE_STEP_INDEX
}

/**
 * Convert a zero-based customization screen index into the 1-based step number
 * in the overall flow (selfie selection is step 1).
 *
 * @example
 * // first customization screen (index 0) -> step 2
 * getCurrentStepForCustomization(0) === 2
 */
export function getCurrentStepForCustomization(customizationIndex: number): number {
  return customizationIndex + SELFIE_STEP_INDEX + 1 // +1 to convert zero-based to 1-based, +1 for selfie step
}
