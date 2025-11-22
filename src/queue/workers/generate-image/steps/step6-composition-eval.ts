import { Logger } from '@/lib/logger'
import { evaluateComposition } from '../evaluators/composition'
import type { Step6Input, Step6Output } from '@/types/generation'

/**
 * Step 6: Evaluate composition
 * Checks natural integration, coherence, no artifacts, logo placement
 */
export async function executeStep6(input: Step6Input, debugMode = false): Promise<Step6Output> {
  const {
    compositionBuffer,
    compositionBase64,
    personReference,
    backgroundReference,
    logoReference,
    generationPrompt
  } = input
  
  Logger.info('V2 Step 6: Evaluating composition', {
    hasBackgroundReference: !!backgroundReference,
    hasLogoReference: !!logoReference
  })
  
  // Get image metadata
  const sharp = (await import('sharp')).default
  const metadata = await sharp(compositionBuffer).metadata()
  
  // Evaluate the composition
  const evaluation = await evaluateComposition(
    {
      imageBase64: compositionBase64,
      imageIndex: 0,
      actualWidth: metadata.width ?? null,
      actualHeight: metadata.height ?? null,
      generationPrompt,
      personReference,
      backgroundReference,
      logoReference
    },
    debugMode
  )
  
  Logger.info('V2 Step 6: Evaluation completed', {
    status: evaluation.status,
    reason: evaluation.reason.substring(0, 100)
  })
  
  return {
    evaluation
  }
}

