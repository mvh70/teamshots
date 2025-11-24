import { deriveLighting } from './derive'
import { generateLightingPrompt } from './prompt'
import { getBackgroundEnvironment } from '../background/config'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import type { LightingInput } from './types'
import { setPath } from '../../prompt-builders/context'

/**
 * Builds lighting input from prompt context
 */
function buildLightingInput(context: PromptBuildContext): LightingInput {
  const { settings } = context

  // Extract background environment
  const backgroundType = settings.background?.type
  const backgroundEnvironment = getBackgroundEnvironment(backgroundType)
  const backgroundModifier = settings.background?.modifier

  // Extract shot type
  const shotType = settings.shotType?.type || 'medium-close-up'

  // Extract subject count (parse string to number)
  const subjectCountStr = settings.subjectCount || '1'
  let subjectCount = 1
  if (subjectCountStr === '2-3') subjectCount = 2
  else if (subjectCountStr === '4-8') subjectCount = 4
  else if (subjectCountStr === '9+') subjectCount = 9

  // Extract preset ID
  const presetId = settings.presetId

  // Extract timeOfDay from settings (comes from package defaults)
  const timeOfDay = (settings as Record<string, unknown>).timeOfDay as string | undefined

  return {
    backgroundEnvironment,
    backgroundModifier,
    timeOfDay,
    shotType,
    presetId,
    subjectCount
  }
}

/**
 * Applies lighting settings to the prompt payload
 */
export function applyToPayload(context: PromptBuildContext): void {
  // Build input from context
  const input = buildLightingInput(context)

  // Derive optimal lighting settings
  const derived = deriveLighting(input)

  // Generate prompt structure
  const prompt = generateLightingPrompt(derived)

  // Apply to payload
  setPath(context.payload, 'lighting.quality', prompt.lighting.quality)
  setPath(context.payload, 'lighting.direction', prompt.lighting.direction)
  setPath(context.payload, 'lighting.setup', prompt.lighting.setup)
  setPath(context.payload, 'lighting.color_temperature', prompt.lighting.color_temperature)
  setPath(context.payload, 'lighting.description', prompt.lighting.description)
}

