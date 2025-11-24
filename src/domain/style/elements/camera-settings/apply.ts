import { deriveCameraSettings } from './derive'
import { generateCameraSettingsPrompt } from './prompt'
import { getBackgroundEnvironment } from '../background/config'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import type { CameraSettingsInput } from './types'
import { setPath } from '../../prompt-builders/context'

/**
 * Builds camera settings input from prompt context
 */
function buildCameraSettingsInput(context: PromptBuildContext): CameraSettingsInput {
  const { settings } = context

  // Extract shot type
  const shotType = settings.shotType?.type || 'medium-close-up'

  // Extract background environment
  const backgroundType = settings.background?.type
  const backgroundEnvironment = getBackgroundEnvironment(backgroundType)
  const backgroundModifier = settings.background?.modifier

  // Extract subject count (parse string to number)
  const subjectCountStr = settings.subjectCount || '1'
  let subjectCount = 1
  if (subjectCountStr === '2-3') subjectCount = 2
  else if (subjectCountStr === '4-8') subjectCount = 4
  else if (subjectCountStr === '9+') subjectCount = 9

  // Extract preset ID if available
  const presetId = settings.presetId

  // Extract timeOfDay and platform from preset context (would be passed through settings or context)
  // These come from the package defaults and would be in extended settings
  const timeOfDay = (settings as Record<string, unknown>).timeOfDay as string | undefined
  const platform = (settings as Record<string, unknown>).platform as string | undefined

  return {
    shotType,
    backgroundEnvironment,
    backgroundModifier,
    subjectCount,
    timeOfDay,
    platform,
    presetId
  }
}

/**
 * Applies camera settings to the prompt payload
 */
export function applyToPayload(context: PromptBuildContext): void {
  // Build input from context
  const input = buildCameraSettingsInput(context)

  // Derive optimal camera settings
  const derived = deriveCameraSettings(input)

  // Generate prompt structure
  const prompt = generateCameraSettingsPrompt(derived)

  // Apply to payload
  setPath(context.payload, 'camera.lens.focal_length_mm', prompt.camera.lens.focal_length_mm)
  setPath(context.payload, 'camera.lens.character', prompt.camera.lens.character)
  setPath(context.payload, 'camera.settings.aperture', prompt.camera.settings.aperture)
  setPath(context.payload, 'camera.settings.iso', prompt.camera.settings.iso)
  setPath(context.payload, 'camera.positioning.distance_from_subject_ft', prompt.camera.positioning.distance_from_subject_ft)
  setPath(context.payload, 'camera.positioning.subject_to_background_ft', prompt.camera.positioning.subject_to_background_ft)
  setPath(context.payload, 'camera.positioning.height', prompt.camera.positioning.height)
  setPath(context.payload, 'camera.color.white_balance_kelvin', prompt.camera.color.white_balance_kelvin)
}

