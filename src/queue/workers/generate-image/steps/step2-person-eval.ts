import { Logger } from '@/lib/logger'
import { evaluatePersonGeneration } from '../evaluators/person'
import type { Step2Input, Step2Output } from '@/types/generation'

/**
 * Step 2: Evaluate person generation
 * Checks person presence, white background, pose/clothing, no labels
 */
export async function executeStep2(input: Step2Input, debugMode = false): Promise<Step2Output> {
  const { personBuffer, personBase64, selfieReferences, generationPrompt, logoReference, brandingPosition } = input
  
  Logger.info('V2 Step 2: Evaluating person generation', {
    hasLogo: !!logoReference,
    brandingPosition
  })
  
  // Get image metadata
  const sharp = (await import('sharp')).default
  const metadata = await sharp(personBuffer).metadata()
  
  // Evaluate the person generation
  const evaluation = await evaluatePersonGeneration(
    {
      imageBase64: personBase64,
      imageIndex: 0,
      actualWidth: metadata.width ?? null,
      actualHeight: metadata.height ?? null,
      generationPrompt,
      selfieReferences,
      logoReference,
      brandingPosition
    },
    debugMode
  )
  
  Logger.info('V2 Step 2: Evaluation completed', {
    status: evaluation.status,
    reason: evaluation.reason.substring(0, 100)
  })
  
  return {
    evaluation
  }
}

