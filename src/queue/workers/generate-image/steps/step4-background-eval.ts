import { Logger } from '@/lib/logger'
import { evaluateBackgroundPreparation } from '../evaluators/background'
import type { Step4Input, Step4Output } from '@/types/generation'

/**
 * Step 4: Evaluate background preparation
 * Validates background assets and instructions
 */
export async function executeStep4(input: Step4Input): Promise<Step4Output> {
  const { backgroundBuffer, backgroundInstructions, logoBuffer, brandingPosition } = input
  
  Logger.info('V2 Step 4: Evaluating background preparation', {
    hasCustomBackground: !!backgroundBuffer,
    hasBackgroundInstructions: !!backgroundInstructions,
    hasLogo: !!logoBuffer,
    brandingPosition
  })
  
  const evaluation = await evaluateBackgroundPreparation(
    backgroundBuffer,
    backgroundInstructions,
    logoBuffer,
    brandingPosition
  )
  
  Logger.info('V2 Step 4: Evaluation completed', {
    status: evaluation.status,
    reason: evaluation.reason
  })
  
  if (evaluation.status !== 'Approved') {
    return {
      isValid: false,
      reason: evaluation.reason
    }
  }
  
  return {
    isValid: true
  }
}

