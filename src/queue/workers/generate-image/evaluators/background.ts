import { Logger } from '@/lib/logger'
import type { EvaluationFeedback } from '@/types/generation'

export async function evaluateBackgroundPreparation(
  backgroundBuffer?: Buffer,
  backgroundInstructions?: string,
  logoBuffer?: Buffer,
  brandingPosition?: string
): Promise<EvaluationFeedback> {
  const issues: string[] = []

  // Validate custom background if provided
  if (backgroundBuffer) {
    try {
      if (backgroundBuffer.length < 100) {
        issues.push('Background image appears to be corrupted or too small')
      }
    } catch {
      issues.push('Background image is invalid')
    }
  }

  // Validate background instructions if provided
  if (backgroundInstructions && !backgroundBuffer) {
    if (backgroundInstructions.trim().length < 10) {
      issues.push('Background instructions are too short or incomplete')
    }
  }

  // Validate logo if provided and it's for background/element branding
  if (logoBuffer && brandingPosition && ['background', 'element'].includes(brandingPosition)) {
    try {
      if (logoBuffer.length < 50) {
        issues.push('Logo image appears to be corrupted or too small')
      }
    } catch {
      issues.push('Logo image is invalid')
    }
  }

  if (issues.length > 0) {
    Logger.warn('Background preparation validation issues', { issues })
    return {
      status: 'Not Approved',
      reason: issues.join(' | '),
      failedCriteria: issues
    }
  }

  return {
    status: 'Approved',
    reason: 'Background assets and instructions validated successfully'
  }
}

