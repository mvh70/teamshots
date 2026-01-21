import { Logger } from '@/lib/logger'
import type { Step8Output } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { generateTextWithGemini, type GeminiReferenceImage } from '../gemini'
import { AI_CONFIG, STAGE_MODEL } from '../config'
import type { CostTrackingHandler } from '../workflow-v3'
import { isFeatureEnabled } from '@/config/feature-flags'
import {
  compositionRegistry,
  type ElementContext,
} from '@/domain/style/elements/composition'
import type { PhotoStyleSettings } from '@/types/photo-style'
import { logPrompt } from '../utils/logging'

export interface V3Step3FinalInput {
  refinedBuffer: Buffer
  refinedBase64: string
  selfieComposite: BaseReferenceImage
  expectedWidth: number
  expectedHeight: number
  aspectRatio: string
  logoReference?: BaseReferenceImage // Logo for background/elements branding evaluation
  generationPrompt?: string // Full prompt JSON with branding info
  styleSettings?: PhotoStyleSettings // For element composition
  generationId?: string // For cost tracking
  personId?: string // For cost tracking
  teamId?: string // For cost tracking
  intermediateS3Key?: string // S3 key of the image being evaluated
  onCostTracking?: CostTrackingHandler // For cost tracking
}

const DIMENSION_TOLERANCE_PX = 50 // Generous tolerance for model variations
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance
const MAX_EVAL_RETRIES = 3 // Retry evaluation on parsing failures (don't regenerate)

/**
 * Compose contributions from all registered elements for the evaluation phase
 */
async function composeElementContributions(
  styleSettings: PhotoStyleSettings,
  generationContext: {
    generationId?: string
    personId?: string
    teamId?: string
  }
): Promise<{
  instructions: string[]
  mustFollow: string[]
  freedom: string[]
}> {
  const elementContext: ElementContext = {
    phase: 'evaluation',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: [], // Not directly available in Step 3, but required by interface
      ...generationContext
    },
    existingContributions: []
  }

  const contributions = await compositionRegistry.composeContributions(elementContext)

  return {
    instructions: contributions.instructions || [],
    mustFollow: contributions.mustFollow || [],
    freedom: contributions.freedom || []
  }
}

/**
 * V3 Step 3: Final evaluation
 * Checks face similarity, characteristic preservation, overall quality
 * Reuses the selfie composite from Step 1 instead of rebuilding it
 */
export async function executeV3Step3(
  input: V3Step3FinalInput, 
  debugMode = false
): Promise<Step8Output> {
  const { refinedBuffer, refinedBase64, selfieComposite, expectedWidth, expectedHeight, aspectRatio, logoReference, generationPrompt, styleSettings } = input

  // Logging handled by logPrompt

  // Try to compose contributions from elements if feature flag is enabled
  let elementContributions: { instructions: string[], mustFollow: string[], freedom: string[] } | null = null
  if (isFeatureEnabled('elementComposition') && styleSettings) {
    try {
      elementContributions = await composeElementContributions(styleSettings, {
        generationId: input.generationId,
        personId: input.personId,
        teamId: input.teamId
      })
      Logger.debug('V3 Step 3: Element composition OK')
    } catch (error) {
      Logger.error('V3 Step 3: Element composition failed, continuing with standard evaluation', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  // Get image metadata
  const sharp = (await import('sharp')).default
  const metadata = await refinedBuffer ? await sharp(refinedBuffer).metadata() : { width: null, height: null }
  
  // Extract branding info from prompt if present
  let brandingInfo: { position?: string; placement?: string } | undefined
  if (generationPrompt) {
    try {
      const promptObj = JSON.parse(generationPrompt)
      const sceneBranding = promptObj.scene?.branding as Record<string, unknown> | undefined
      if (sceneBranding && sceneBranding.enabled === true) {
        brandingInfo = {
          position: sceneBranding.position as string | undefined,
          placement: sceneBranding.placement as string | undefined
        }
      }
    } catch (error) {
      Logger.warn('V3 Step 3: Failed to parse generation prompt for branding info', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  
  // Inlined Evaluation Logic (replacing evaluateFinalImage)
  const modelName = STAGE_MODEL.EVALUATION

  Logger.debug('V3 Step 3: Evaluating final image', { modelName })
  
  const actualWidth = metadata.width
  const actualHeight = metadata.height

  // Calculate dimension and aspect ratio checks
  // Gemini often fails on dimensions despite format frame reference, so we need to check here
  const expectedRatio = expectedWidth / expectedHeight
  const actualRatio =
    actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

  const dimensionMismatch =
    actualWidth === null ||
    actualHeight === null ||
    Math.abs(actualWidth - expectedWidth) > DIMENSION_TOLERANCE_PX ||
    Math.abs(actualHeight - expectedHeight) > DIMENSION_TOLERANCE_PX

  const aspectMismatch =
    actualRatio === null ? true : Math.abs(actualRatio - expectedRatio) > ASPECT_RATIO_TOLERANCE

  // Check for selfie duplicate (simplified check, assuming selfieComposite is the reference)
  // Since we pass the composite, we don't do per-selfie dupe check here unless we unpack it.
  // But V3 usually passes composite. Let's assume no exact base64 match for composite vs output.
  
  // Auto-reject if dimension/aspect fails (despite format frame reference in Step 2)
  if (dimensionMismatch || aspectMismatch) {
    const dimIssue = dimensionMismatch
      ? `Dimension mismatch (expected ${expectedWidth}x${expectedHeight}px, actual ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px)`
      : ''
    const aspectIssue = aspectMismatch
      ? `Aspect ratio mismatch (expected ${aspectRatio} ≈${expectedRatio.toFixed(4)}, actual ${
          actualRatio !== null ? actualRatio.toFixed(4) : 'unknown'
        })`
      : ''
    const reason = [dimIssue, aspectIssue].filter(Boolean).join('; ')
    
    Logger.warn('V3 Step 3: Dimension/aspect check failed', { reason })
    
    return {
      evaluation: {
        status: 'Not Approved',
        reason,
        failedCriteria: [reason]
      }
    }
  }
  
  const instructions = [
    `You are evaluating the final refined image for face similarity, characteristic preservation, person prominence, and overall quality.`,
    `Answer each question with ONLY: YES (criterion met), NO (criterion failed), UNCERTAIN (cannot determine)`,
    '',
    'Questions:',
    '',
    '1. face_similarity',
    '   - Does the face in the final image closely match the selfie references?',
    '   - Are specific characteristics preserved (moles, freckles, scars, eye shape)?',
    '',
    '2. characteristic_preservation',
    '   - Are unique facial features maintained without beautification?',
    '   - Does the person look like themselves, not an idealized version?',
    '',
    '3. person_prominence',
    '   - Is the person the DOMINANT element in the frame (40-50%+ of image height)?',
    '   - Is the person LARGER than background elements (banners, signs, logos)?',
    '',
    '4. overall_quality',
    '   - Is the image professional and high quality?',
    '   - Are there no obvious defects or artifacts?'
  ]

  // Add branding evaluation if applicable
  if (brandingInfo && logoReference) {
    instructions.push(
      '',
      '6. branding_placement',
      `   - Is the logo placed in the ${brandingInfo.position === 'background' ? 'background' : 'scene elements'}?`,
      `   - CRITICAL HEIGHT REQUIREMENT: If the logo is on the background, it must appear BEHIND THE HEAD OR SHOULDERS (upper body), NOT behind the torso, waist, or lower body.`,
      `   - The logo should be visible at HEAD/SHOULDER level in the UPPER portion of the frame for professional appearance.`,
      `   - CRITICAL: Occlusion by the foreground subject (person) is DESIRABLE and creates professional depth.`,
      `   - If the person naturally occludes part of the logo (hiding text, covering portions), this is EXCELLENT composition.`,
      `   - Example: If logo is "TeamShots Pro" and the person covers "Pro", leaving only "TeamShot" visible - this is CORRECT and should be YES.`,
      `   - The VISIBLE portions of the logo should match the reference (colors, font, design where visible).`,
      `   - Answer YES if: any recognizable part of the logo is visible at head/shoulder height AND matches the reference in visible areas.`,
      `   - Answer YES even if: large portions of the logo are hidden behind the person (this adds depth) - as long as it's at the correct height.`,
      `   - Answer NO if: the logo is COMPLETELY invisible (0% visible), OR positioned too LOW (behind torso/waist instead of head/shoulders), OR the visible parts don't match the reference, OR placement looks unnaturally pasted.`,
      `   - Placement specification: ${brandingInfo.placement || 'as specified'} (partial occlusion still counts as correctly placed).`,
      `   - Does it look natural and properly integrated into the scene?`
    )
  }

  // Add element composition instructions if available
  if (elementContributions && elementContributions.mustFollow && elementContributions.mustFollow.length > 0) {
    instructions.push(
      '',
      'Additional Evaluation Criteria (from element composition):',
      ...elementContributions.mustFollow.map(rule => `   - ${rule}`)
    )
    // Element criteria added
  }

  instructions.push(
    '',
    'Return ONLY valid JSON with all fields and explanations.'
  )

  // Update example format based on whether branding is present
  if (brandingInfo && logoReference) {
    instructions.push(
      'Example format:',
      '{',
      '  "face_similarity": "YES",',
      '  "characteristic_preservation": "YES",',
      '  "person_prominence": "YES",',
      '  "overall_quality": "YES",',
      '  "branding_placement": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
      '    "person_prominence": "Person occupies ~50% of image height",',
      '    "branding_placement": "Logo visible and properly placed"',
      '  }',
      '}'
    )
  } else {
    instructions.push(
      'Example format:',
      '{',
      '  "face_similarity": "YES",',
      '  "characteristic_preservation": "YES",',
      '  "person_prominence": "YES",',
      '  "overall_quality": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
      '    "person_prominence": "Person occupies ~50% of image height"',
      '  }',
      '}'
    )
  }

  const evalPromptText = instructions.join('\n')
  
  // Log the evaluation prompt
  logPrompt('V3 Step 3 Eval', evalPromptText, input.generationId)

  // Build reference images array for multi-modal evaluation
  const evalImages: GeminiReferenceImage[] = [
    { mimeType: 'image/png', base64: refinedBase64, description: 'Final refined image to evaluate' },
    { mimeType: selfieComposite.mimeType, base64: selfieComposite.base64, description: selfieComposite.description || 'Selfie composite reference' }
  ]

  // Add logo reference if branding evaluation is needed
  if (brandingInfo && logoReference) {
    evalImages.push({
      mimeType: logoReference.mimeType,
      base64: logoReference.base64,
      description: logoReference.description || 'Logo reference'
    })
  }

  let evalDurationMs = 0
  let usageMetadata: { inputTokens?: number; outputTokens?: number } | undefined
  let providerUsed: 'vertex' | 'gemini-rest' | 'openrouter' | undefined
  let lastError: Error | null = null

  // Retry loop for evaluation - retry on parsing failures instead of regenerating
  for (let evalAttempt = 1; evalAttempt <= MAX_EVAL_RETRIES; evalAttempt++) {
    const evalStartTime = Date.now()
    lastError = null

    try {
      // Use multi-provider fallback stack for evaluation
      const response = await generateTextWithGemini(evalPromptText, evalImages, {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE,
        stage: 'EVALUATION',
      })

      evalDurationMs = response.usage.durationMs
      usageMetadata = {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
      }
      providerUsed = response.providerUsed
      const textPart = response.text

      Logger.debug('V3 Step 3 Eval: Provider used', { provider: providerUsed, model: modelName, evalAttempt })

      if (textPart) {
        const evaluation = parseFinalEvaluation(textPart)
        if (evaluation) {
          // Auto-reject for critical failures (face/characteristics are non-negotiable)
          const autoReject = [
            evaluation.face_similarity === 'NO',
            evaluation.characteristic_preservation === 'NO'
          ].some(Boolean)

          // Check all required criteria including prominence and branding if applicable
          const baseApproved =
            evaluation.face_similarity === 'YES' &&
            evaluation.characteristic_preservation === 'YES' &&
            evaluation.person_prominence === 'YES' &&
            evaluation.overall_quality === 'YES'

          const brandingApproved = (brandingInfo && logoReference)
            ? evaluation.branding_placement === 'YES'
            : true // If no branding required, consider it approved

          const allApproved = baseApproved && brandingApproved

          const finalStatus: 'Approved' | 'Not Approved' = autoReject || !allApproved ? 'Not Approved' : 'Approved'

          const failedCriteria: string[] = []
          Object.entries(evaluation).forEach(([key, value]) => {
            if (key === 'explanations') return
            if (value === 'NO' || value === 'UNCERTAIN') {
              const explanation = evaluation.explanations[key] || 'No explanation provided'
              failedCriteria.push(`${key}: ${value} (${explanation})`)
            }
          })

          // Log evaluation results
          Logger.info('V3 Step 3: Evaluation result', {
            status: finalStatus,
            face_similarity: evaluation.face_similarity,
            characteristic_preservation: evaluation.characteristic_preservation,
            person_prominence: evaluation.person_prominence,
            overall_quality: evaluation.overall_quality,
            ...(evaluation.branding_placement ? { branding_placement: evaluation.branding_placement } : {})
          })

          // Log face similarity metric for analytics
          const faceScore = getFaceSimilarityScore(evaluation.face_similarity)
          Logger.info('V3 Step 3: Face similarity metric', {
            generationId: input.generationId,
            faceSimilarity: evaluation.face_similarity,
            score: faceScore
          })

          const finalReason = failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met'

          // Track evaluation cost with outcome
          if (input.onCostTracking && usageMetadata) {
            try {
              await input.onCostTracking({
                stepName: 'step3-final-eval',
                reason: 'evaluation',
                result: 'success',
                model: STAGE_MODEL.EVALUATION,
                provider: providerUsed,
                inputTokens: usageMetadata.inputTokens,
                outputTokens: usageMetadata.outputTokens,
                durationMs: evalDurationMs,
                evaluationStatus: finalStatus === 'Approved' ? 'approved' : 'rejected',
                rejectionReason: finalStatus === 'Not Approved' ? finalReason : undefined,
                intermediateS3Key: input.intermediateS3Key,
              })
            } catch (costError) {
              Logger.error('V3 Step 3: Failed to track evaluation cost', {
                error: costError instanceof Error ? costError.message : String(costError),
                generationId: input.generationId,
              })
            }
          }

          return {
            evaluation: {
              status: finalStatus,
              reason: finalReason,
              failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined,
              suggestedAdjustments: finalStatus === 'Not Approved' ? generateAdjustmentSuggestions(failedCriteria) : undefined
            }
          }
        }
      }

      // Parsing failed - log and retry
      Logger.warn('V3 Step 3: Parsing failed, retrying evaluation', {
        evalAttempt,
        maxRetries: MAX_EVAL_RETRIES,
        responseLength: textPart?.length || 0,
      })

    } catch (error) {
      evalDurationMs = Date.now() - evalStartTime
      lastError = error instanceof Error ? error : new Error(String(error))

      Logger.warn('V3 Step 3: Evaluation attempt failed', {
        evalAttempt,
        maxRetries: MAX_EVAL_RETRIES,
        error: lastError.message,
      })

      // Track failed evaluation cost for this attempt
      if (input.onCostTracking) {
        try {
          await input.onCostTracking({
            stepName: 'step3-final-eval',
            reason: 'evaluation',
            result: 'failure',
            model: STAGE_MODEL.EVALUATION,
            provider: providerUsed,
            durationMs: evalDurationMs,
            errorMessage: lastError.message,
          })
        } catch (costError) {
          Logger.error('V3 Step 3: Failed to track failed evaluation cost', {
            error: costError instanceof Error ? costError.message : String(costError),
          })
        }
      }

      // If this was the last attempt, throw the error
      if (evalAttempt === MAX_EVAL_RETRIES) {
        Logger.error('V3 Step 3: All evaluation retries exhausted (API errors)', {
          totalAttempts: MAX_EVAL_RETRIES,
        })
        throw lastError
      }
    }
  }

  // All retries exhausted due to parsing failures
  const rejectionReason = `Evaluation did not return a valid structured response after ${MAX_EVAL_RETRIES} attempts.`

  Logger.error('V3 Step 3: All evaluation retries exhausted (parsing failures)', {
    totalAttempts: MAX_EVAL_RETRIES,
  })

  // Track evaluation cost with rejection for parsing failure
  if (input.onCostTracking && usageMetadata) {
    try {
      await input.onCostTracking({
        stepName: 'step3-final-eval',
        reason: 'evaluation',
        result: 'success',
        model: STAGE_MODEL.EVALUATION,
        provider: providerUsed,
        inputTokens: usageMetadata.inputTokens,
        outputTokens: usageMetadata.outputTokens,
        durationMs: evalDurationMs,
        evaluationStatus: 'rejected',
        rejectionReason,
        intermediateS3Key: input.intermediateS3Key,
      })
    } catch (costError) {
      Logger.error('V3 Step 3: Failed to track evaluation cost for parsing failure', {
        error: costError instanceof Error ? costError.message : String(costError),
      })
    }
  }

  return {
    evaluation: {
      status: 'Not Approved',
      reason: rejectionReason
    }
  }
}

function parseFinalEvaluation(text: string) {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const result: {
      face_similarity: 'YES' | 'NO' | 'UNCERTAIN'
      characteristic_preservation: 'YES' | 'NO' | 'UNCERTAIN'
      person_prominence: 'YES' | 'NO' | 'UNCERTAIN'
      overall_quality: 'YES' | 'NO' | 'UNCERTAIN'
      branding_placement?: 'YES' | 'NO' | 'UNCERTAIN'
      explanations: Record<string, string>
    } = {
      face_similarity: normalizeYesNoUncertain(parsed.face_similarity),
      characteristic_preservation: normalizeYesNoUncertain(parsed.characteristic_preservation),
      person_prominence: normalizeYesNoUncertain(parsed.person_prominence),
      overall_quality: normalizeYesNoUncertain(parsed.overall_quality),
      explanations: (parsed.explanations as Record<string, string>) || {}
    }
    
    // Add branding_placement if present in response
    if (parsed.branding_placement !== undefined) {
      result.branding_placement = normalizeYesNoUncertain(parsed.branding_placement)
    }
    
    return result
  } catch (error) {
    Logger.warn('Failed to parse final evaluation JSON', {
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

function normalizeYesNoUncertain(value: unknown): 'YES' | 'NO' | 'UNCERTAIN' {
  if (typeof value !== 'string') return 'UNCERTAIN'
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'UNCERTAIN'
}

function generateAdjustmentSuggestions(failedCriteria: string[]): string {
  const suggestions: string[] = []
  
  for (const criterion of failedCriteria) {
    if (criterion.includes('face_similarity')) {
      suggestions.push('Improve face matching to selfie references')
    }
    if (criterion.includes('characteristic_preservation')) {
      suggestions.push('Maintain unique facial features without beautification')
    }
    if (criterion.includes('person_prominence')) {
      suggestions.push('Make person LARGER (40-50%+ of image height)')
    }
    if (criterion.includes('branding_placement')) {
      suggestions.push('Ensure logo is visible and properly placed')
    }
    if (criterion.includes('overall_quality')) {
      suggestions.push('Improve image quality')
    }
  }
  
  return suggestions.join('; ')
}

/**
 * Convert face similarity evaluation to numeric score for logging
 * YES = 100, UNCERTAIN = 50, NO = 0, undefined = -1
 */
function getFaceSimilarityScore(value: 'YES' | 'NO' | 'UNCERTAIN' | undefined): number {
  switch (value) {
    case 'YES': return 100
    case 'UNCERTAIN': return 50
    case 'NO': return 0
    default: return -1
  }
}
