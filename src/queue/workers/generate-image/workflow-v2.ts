import { Logger } from '@/lib/logger'
import { getProgressMessage, formatProgressMessage } from '@/lib/generation-progress-messages'
import { promises as fs } from 'fs'
import path from 'path'
import type { Job } from 'bullmq'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { ReferenceImage, DownloadAssetFn } from '@/types/generation'
import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { isRateLimitError, RATE_LIMIT_SLEEP_MS } from '@/lib/rate-limit-retry'

// Step imports
import { executeStep1 } from './steps/step1-person'
import { executeStep2 } from './steps/step2-person-eval'
import { executeStep3 } from './steps/step3-background'
import { executeStep4 } from './steps/step4-background-eval'
import { executeStep5 } from './steps/step5-composition'
import { executeStep6 } from './steps/step6-composition-eval'
import { executeStep7 } from './steps/step7-refinement'
import { executeStep8 } from './steps/step8-final-eval'

// Delay utility
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface V2WorkflowInput {
  job: Job
  generationId: string
  personId: string
  userId?: string
  selfieReferences: { label: string; base64: string; mimeType: string }[]
  styleSettings: PhotoStyleSettings
  prompt: string
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  downloadAsset: DownloadAssetFn
  currentAttempt: number
  maxAttempts: number
  debugMode?: boolean
}

export interface V2WorkflowResult {
  approvedImageBuffers: Buffer[]
}

/**
 * Save intermediate file for debugging
 */
async function saveIntermediateFile(
  buffer: Buffer,
  stepName: string,
  generationId: string,
  debugMode: boolean
): Promise<void> {
  if (!debugMode) return

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${stepName}-${generationId}-${timestamp}.png`
    const tmpDir = path.join(process.cwd(), 'tmp', 'v2-debug')

    await fs.mkdir(tmpDir, { recursive: true })

    const filePath = path.join(tmpDir, filename)
    await fs.writeFile(filePath, buffer)

    Logger.info(`Saved intermediate file: ${filePath}`, {
      step: stepName,
      generationId,
      filePath
    })
  } catch (error) {
    Logger.warn('Failed to save intermediate file', {
      step: stepName,
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

/**
 * Execute the V2 8-step image generation workflow
 */
export async function executeV2Workflow({
  job,
  generationId,
  selfieReferences,
  styleSettings,
  prompt,
  aspectRatio,
  resolution,
  downloadAsset,
  currentAttempt,
  debugMode = false
}: V2WorkflowInput): Promise<V2WorkflowResult> {
  // Get expected dimensions from aspect ratio using centralized utility
  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const expectedWidth = aspectRatioConfig.width
  const expectedHeight = aspectRatioConfig.height

  // Derive shot description from style settings
  const shotTypeInput = typeof styleSettings.shotType?.type === 'string' 
    ? styleSettings.shotType.type 
    : undefined
  const shotTypeConfig = resolveShotType(shotTypeInput)
  const shotDescription = shotTypeConfig.framingDescription

  Logger.info('Starting V2 image generation workflow (8 steps)', {
    generationId,
    debugMode,
    attempt: currentAttempt,
    aspectRatio,
    expectedDimensions: `${expectedWidth}x${expectedHeight}`
  })

  // Selfie rotation is already normalized in generateImage.ts before PNG conversion
  // No need to normalize again here
  const processedSelfieReferences = selfieReferences

  // Log base prompt from package builder in debug mode
  if (debugMode) {
    Logger.info('V2 DEBUG - Base Prompt from Package Builder:', {
      generationId,
      prompt: prompt.substring(0, 8000) + (prompt.length > 8000 ? '...(truncated)' : ''),
      promptLength: prompt.length
    })
  }

  // Helper to format progress messages with attempt info
  const formatProgressWithAttempt = (
    progressMessage: { message: string; emoji?: string },
    progress: number
  ): string => {
    const formatted = formatProgressMessage(progressMessage)
    return `Generation #${currentAttempt}\n${progress}% - ${formatted}`
  }

  // STEP 1: Generate person on white background
  await job.updateProgress({
    progress: 10,
    message: formatProgressWithAttempt(getProgressMessage('v2-generating-person'), 10)
  })

  let step1Output
  let step1Attempts = 0
  const maxStep1Attempts = 3

  while (step1Attempts < maxStep1Attempts) {
    step1Attempts++

    Logger.info('V2 Step 1: Attempt', { attempt: step1Attempts, max: maxStep1Attempts })

    // Prepare logo reference if needed
    let logoReference: ReferenceImage | undefined
    if (styleSettings.branding?.type === 'include' &&
        styleSettings.branding.position === 'clothing' &&
        styleSettings.branding.logoKey) {
      try {
        const logoAsset = await downloadAsset(styleSettings.branding.logoKey)
        if (logoAsset) {
          logoReference = {
            description: 'Company logo',
            base64: logoAsset.base64,
            mimeType: logoAsset.mimeType
          }
        }
      } catch (error) {
        Logger.warn('Failed to load logo for Step 1', { error })
      }
    }

    let currentStep1Output
    let rateLimitRetries = 0
    const maxRateLimitRetries = 3

    while (true) {
      try {
        currentStep1Output = await executeStep1(
          {
            selfieReferences: processedSelfieReferences,
            basePrompt: prompt,
            styleSettings,
            logoReference,
            aspectRatio,
            resolution
          },
          step1Attempts > 1 ? {
            attempt: step1Attempts,
            maxAttempts: maxStep1Attempts,
            previousFeedback: step1Output ? (await executeStep2({
              personBuffer: step1Output.personBuffer,
              personBase64: step1Output.personBase64,
              selfieReferences: processedSelfieReferences,
              generationPrompt: step1Output.personPrompt,
              logoReference,
              brandingPosition: styleSettings.branding?.position
            }, debugMode)).evaluation : undefined
          } : undefined,
          debugMode
        )
        break // Success, exit rate limit retry loop
      } catch (error) {
        if (isRateLimitError(error)) {
          rateLimitRetries += 1
          if (rateLimitRetries > maxRateLimitRetries) {
            Logger.error('Exceeded Step 1 rate-limit retries', {
              generationId,
              rateLimitRetries
            })
            throw error
          }

          const waitSeconds = Math.round(RATE_LIMIT_SLEEP_MS / 1000)
          Logger.warn('Step 1 rate limited; waiting before retry', {
            generationId,
            waitSeconds,
            rateLimitRetries,
            attempt: step1Attempts
          })

          await job.updateProgress({
            progress: 10,
            message: formatProgressWithAttempt({
              message: `Gemini is busy (rate limited). Trying again in ${waitSeconds} seconds...`,
              emoji: '⏳'
            }, 10)
          })

          await delay(RATE_LIMIT_SLEEP_MS)
          continue
        }
        // Re-throw non-rate-limit errors
        throw error
      }
    }

    step1Output = currentStep1Output

    await saveIntermediateFile(step1Output.personBuffer, 'step1-person', generationId, debugMode)

    // STEP 2: Evaluate person generation
    const step2Output = await executeStep2({
      personBuffer: step1Output.personBuffer,
      personBase64: step1Output.personBase64,
      selfieReferences: processedSelfieReferences,
      generationPrompt: step1Output.personPrompt,
      logoReference,
      brandingPosition: styleSettings.branding?.position
    }, debugMode)

    if (step2Output.evaluation.status === 'Approved') {
      Logger.info('V2 Step 2: Person generation approved')
      break
    }

    Logger.warn('V2 Step 2: Person generation not approved', {
      attempt: step1Attempts,
      reason: step2Output.evaluation.reason
    })

    if (step1Attempts >= maxStep1Attempts) {
      throw new Error(`Step 1 failed after ${maxStep1Attempts} attempts: ${step2Output.evaluation.reason}`)
    }
  }

  // STEP 3: Prepare background and scene specifications
  await job.updateProgress({
    progress: 30,
    message: formatProgressWithAttempt(getProgressMessage('v2-preparing-background'), 30)
  })

  const step3Output = await executeStep3({
    styleSettings,
    basePrompt: prompt,
    downloadAsset
  })

  if (debugMode) {
    if (step3Output.backgroundBuffer) {
      await saveIntermediateFile(step3Output.backgroundBuffer, 'step3-background', generationId, debugMode)
    }
    if (step3Output.logoBuffer) {
      await saveIntermediateFile(step3Output.logoBuffer, 'step3-logo', generationId, debugMode)
    }
  }

  // STEP 4: Evaluate background preparation
  const step4Output = await executeStep4({
    backgroundBuffer: step3Output.backgroundBuffer,
    backgroundInstructions: step3Output.backgroundInstructions,
    logoBuffer: step3Output.logoBuffer,
    brandingPosition: styleSettings.branding?.position
  })

  if (!step4Output.isValid) {
    throw new Error(`Step 4 validation failed: ${step4Output.reason}`)
  }

  // STEP 5: Compose person + background
  await job.updateProgress({
    progress: 55,
    message: formatProgressWithAttempt(getProgressMessage('v2-compositing'), 55)
  })

  let step5Output
  let step5Attempts = 0
  const maxStep5Attempts = 3

  while (step5Attempts < maxStep5Attempts) {
    step5Attempts++

    Logger.info('V2 Step 5: Attempt', { attempt: step5Attempts, max: maxStep5Attempts })

    let currentStep5Output
    let rateLimitRetries = 0
    const maxRateLimitRetries = 3

    while (true) {
      try {
        currentStep5Output = await executeStep5(
          {
            personBuffer: step1Output!.personBuffer,
            backgroundBuffer: step3Output.backgroundBuffer,
            backgroundInstructions: step3Output.backgroundInstructions,
            logoBuffer: step3Output.logoBuffer,
            basePrompt: prompt,
            aspectRatio,
            aspectRatioDescription: aspectRatioConfig.id,
            expectedWidth,
            expectedHeight,
            resolution,
            styleSettings,
            shotDescription
          },
          step5Attempts > 1 ? {
            attempt: step5Attempts,
            maxAttempts: maxStep5Attempts,
            previousFeedback: step5Output ? (await executeStep6({
              compositionBuffer: step5Output.compositionBuffer,
              compositionBase64: step5Output.compositionBase64,
              personReference: {
                description: 'Person reference',
                base64: step1Output!.personBase64,
                mimeType: 'image/png'
              },
              backgroundReference: step3Output.backgroundBuffer ? {
                description: 'Background reference',
                base64: step3Output.backgroundBuffer.toString('base64'),
                mimeType: 'image/png'
              } : undefined,
              logoReference: step3Output.logoBuffer ? {
                description: 'Logo reference',
                base64: step3Output.logoBuffer.toString('base64'),
                mimeType: 'image/png'
              } : undefined,
              generationPrompt: prompt
            }, debugMode)).evaluation : undefined
          } : undefined,
          debugMode
        )
        break // Success, exit rate limit retry loop
      } catch (error) {
        if (isRateLimitError(error)) {
          rateLimitRetries += 1
          if (rateLimitRetries > maxRateLimitRetries) {
            Logger.error('Exceeded Step 5 rate-limit retries', {
              generationId,
              rateLimitRetries
            })
            throw error
          }

          const waitSeconds = Math.round(RATE_LIMIT_SLEEP_MS / 1000)
          Logger.warn('Step 5 rate limited; waiting before retry', {
            generationId,
            waitSeconds,
            rateLimitRetries,
            attempt: step5Attempts
          })

          await job.updateProgress({
            progress: 55,
            message: formatProgressWithAttempt({
              message: `Gemini is busy (rate limited). Trying again in ${waitSeconds} seconds...`,
              emoji: '⏳'
            }, 55)
          })

          await delay(RATE_LIMIT_SLEEP_MS)
          continue
        }
        // Re-throw non-rate-limit errors
        throw error
      }
    }

    step5Output = currentStep5Output

    await saveIntermediateFile(step5Output.compositionBuffer, 'step5-composition', generationId, debugMode)

    // STEP 6: Evaluate composition
    const step6Output = await executeStep6({
      compositionBuffer: step5Output.compositionBuffer,
      compositionBase64: step5Output.compositionBase64,
      personReference: {
        description: 'Person reference',
        base64: step1Output!.personBase64,
        mimeType: 'image/png'
      },
      backgroundReference: step3Output.backgroundBuffer ? {
        description: 'Background reference',
        base64: step3Output.backgroundBuffer.toString('base64'),
        mimeType: 'image/png'
      } : undefined,
      logoReference: step3Output.logoBuffer ? {
        description: 'Logo reference',
        base64: step3Output.logoBuffer.toString('base64'),
        mimeType: 'image/png'
      } : undefined,
      generationPrompt: prompt
    }, debugMode)

    if (step6Output.evaluation.status === 'Approved') {
      Logger.info('V2 Step 6: Composition approved')
      break
    }

    Logger.warn('V2 Step 6: Composition not approved', {
      attempt: step5Attempts,
      reason: step6Output.evaluation.reason
    })

    if (step5Attempts >= maxStep5Attempts) {
      throw new Error(`Step 5 failed after ${maxStep5Attempts} attempts: ${step6Output.evaluation.reason}`)
    }
  }

  // STEP 7: Final face refinement
  await job.updateProgress({
    progress: 80,
    message: formatProgressWithAttempt(getProgressMessage('v2-refining'), 80)
  })

  let step7Output
  let step7Attempts = 0
  const maxStep7Attempts = 2

  while (step7Attempts < maxStep7Attempts) {
    step7Attempts++

    Logger.info('V2 Step 7: Attempt', { attempt: step7Attempts, max: maxStep7Attempts })

    let currentStep7Output
    let rateLimitRetries = 0
    const maxRateLimitRetries = 3

    while (true) {
      try {
        currentStep7Output = await executeStep7(
          {
            compositionBuffer: step5Output!.compositionBuffer,
            selfieReferences: processedSelfieReferences,
            aspectRatio,
            resolution
          },
          step7Attempts > 1 ? {
            attempt: step7Attempts,
            maxAttempts: maxStep7Attempts,
            previousFeedback: step7Output ? (await executeStep8({
              refinedBuffer: step7Output.refinedBuffer,
              refinedBase64: step7Output.refinedBase64,
              selfieReferences: processedSelfieReferences,
              expectedWidth,
              expectedHeight,
              aspectRatio
            }, debugMode)).evaluation : undefined
          } : undefined,
          debugMode
        )
        break // Success, exit rate limit retry loop
      } catch (error) {
        if (isRateLimitError(error)) {
          rateLimitRetries += 1
          if (rateLimitRetries > maxRateLimitRetries) {
            Logger.error('Exceeded Step 7 rate-limit retries', {
              generationId,
              rateLimitRetries
            })
            throw error
          }

          const waitSeconds = Math.round(RATE_LIMIT_SLEEP_MS / 1000)
          Logger.warn('Step 7 rate limited; waiting before retry', {
            generationId,
            waitSeconds,
            rateLimitRetries,
            attempt: step7Attempts
          })

          await job.updateProgress({
            progress: 80,
            message: formatProgressWithAttempt({
              message: `Gemini is busy (rate limited). Trying again in ${waitSeconds} seconds...`,
              emoji: '⏳'
            }, 80)
          })

          await delay(RATE_LIMIT_SLEEP_MS)
          continue
        }
        // Re-throw non-rate-limit errors
        throw error
      }
    }

    step7Output = currentStep7Output

    await saveIntermediateFile(step7Output.refinedBuffer, 'step7-refined', generationId, debugMode)

    // STEP 8: Final evaluation
    const step8Output = await executeStep8({
      refinedBuffer: step7Output.refinedBuffer,
      refinedBase64: step7Output.refinedBase64,
      selfieReferences: processedSelfieReferences,
      expectedWidth,
      expectedHeight,
      aspectRatio
    }, debugMode)

    if (step8Output.evaluation.status === 'Approved') {
      Logger.info('V2 Step 8: Final image approved')
      break
    }

    Logger.warn('V2 Step 8: Final image not approved', {
      attempt: step7Attempts,
      reason: step8Output.evaluation.reason
    })

    if (step7Attempts >= maxStep7Attempts) {
      throw new Error(`Step 7 failed after ${maxStep7Attempts} attempts: ${step8Output.evaluation.reason}`)
    }
  }

  await job.updateProgress({
    progress: 100,
    message: formatProgressWithAttempt({ message: 'Generation complete', emoji: '✅' }, 100)
  })

  Logger.info('V2 workflow completed successfully', {
    generationId,
    step1Attempts,
    step5Attempts,
    step7Attempts
  })

  return {
    approvedImageBuffers: [step7Output!.refinedBuffer]
  }
}

