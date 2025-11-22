import { Logger } from '@/lib/logger'
import { evaluateFinalImage } from '../evaluators/final'
import type { Step8Input, Step8Output } from '@/types/generation'

/**
 * Step 8: Final evaluation
 * Checks face similarity, characteristic preservation, overall quality
 */
export async function executeStep8(input: Step8Input, debugMode = false): Promise<Step8Output> {
  const { refinedBuffer, refinedBase64, selfieReferences, expectedWidth, expectedHeight, aspectRatio } = input
  
  Logger.info('V2 Step 8: Evaluating final refined image')
  
  // Get image metadata
  const sharp = (await import('sharp')).default
  const metadata = await refinedBuffer ? await sharp(refinedBuffer).metadata() : { width: null, height: null }
  
  // Evaluate the final image
  const evaluation = await evaluateFinalImage(
    refinedBase64,
    selfieReferences,
    metadata.width ?? null,
    metadata.height ?? null,
    expectedWidth,
    expectedHeight,
    aspectRatio,
    debugMode
  )
  
  Logger.info('V2 Step 8: Evaluation completed', {
    status: evaluation.status,
    reason: evaluation.reason.substring(0, 100)
  })
  
  return {
    evaluation
  }
}

