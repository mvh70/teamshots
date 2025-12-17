import { Logger } from '@/lib/logger'
import type { Step8Output } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { CostTrackingHandler } from '../workflow-v3'
import { isFeatureEnabled } from '@/config/feature-flags'
import {
  compositionRegistry,
  type ElementContext,
} from '@/domain/style/elements/composition'
import type { PhotoStyleSettings } from '@/types/photo-style'

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

const DIMENSION_TOLERANCE_PX = 2
const ASPECT_RATIO_TOLERANCE = 0.02

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
    generationContext,
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
  const { refinedBuffer, refinedBase64, selfieComposite, expectedWidth, expectedHeight, aspectRatio, logoReference, generationPrompt } = input
  
  Logger.debug('V3 Step 3: Evaluating final refined image')
  
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
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
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
  
  const model = await getVertexGenerativeModel(modelName)

  const instructions = [
    `You are evaluating the final refined image for face similarity, body framing, person prominence, and overall quality.`,
    `Answer each question with ONLY: YES (criterion fully met), NO (criterion failed), UNCERTAIN (cannot determine)`,
    '',
    'Questions:',
    '',
    '1. face_similarity',
    '   - Does the face in the final image closely match the selfie references?',
    '   - Are specific characteristics preserved (moles, freckles, scars, eye shape)?',
    '   - Is the facial structure and features accurate?',
    '',
    '2. characteristic_preservation',
    '   - Are unique facial features maintained without beautification?',
    '   - Does the person look like themselves, not an idealized version?',
    '',
    '3. shot_type_match',
    '   - Does the image reasonably match the REQUESTED shot type from the generation prompt?',
    '   - For medium-shot: Person should be cropped around waist/belt area (±15% tolerance). Accept if cropped between bottom ribcage and top of hips.',
    '   - For three-quarter: Person shown from head to mid-thigh (±15% tolerance). Accept if cropped between waist and knees.',
    '   - For full-shot: Person shown from head to feet. Should include full body.',
    '   - For close-up/headshot: Person shown from head to chest/shoulders.',
    '   - Answer YES if body is cropped within reasonable tolerance of the shot type.',
    '   - Answer NO only if shot type is SIGNIFICANTLY wrong (e.g., showing full legs when medium-shot requested, or only head when full-shot requested).',
    '   - Minor variations in exact crop point (±10-15%) should be ACCEPTED as long as the general shot type is correct.',
    '',
    '4. person_prominence',
    '   - Is the person the DOMINANT element in the frame?',
    '   - Does the person occupy at least 40-50% of the image height?',
    '   - Is the person LARGER than background elements like banners, signs, or logos?',
    '   - Answer NO if the person appears too small relative to the background or is dwarfed by background elements.',
    '',
    '5. overall_quality',
    '   - Is the image professional and high quality?',
    '   - Are there no obvious defects or artifacts?',
    '   - Does the composition work well overall?'
  ]

  // Add branding evaluation if applicable
  if (brandingInfo && logoReference) {
    instructions.push(
      '',
      '6. branding_placement',
      `   - Is the logo placed in the ${brandingInfo.position === 'background' ? 'background' : 'scene elements'}?`,
      `   - CRITICAL: Occlusion by the foreground subject (person) is DESIRABLE and creates professional depth.`,
      `   - If the person naturally occludes part of the logo (hiding text, covering portions), this is EXCELLENT composition.`,
      `   - Example: If logo is "TeamShots Pro" and the person covers "Pro", leaving only "TeamShot" visible - this is CORRECT and should be YES.`,
      `   - The VISIBLE portions of the logo should match the reference (colors, font, design where visible).`,
      `   - Answer YES if: any recognizable part of the logo is visible AND matches the reference in visible areas.`,
      `   - Answer YES even if: large portions of the logo are hidden behind the person (this adds depth).`,
      `   - Answer NO only if: the logo is COMPLETELY invisible (0% visible), OR the visible parts don't match the reference, OR placement looks unnaturally pasted.`,
      `   - Placement specification: ${brandingInfo.placement || 'as specified'} (partial occlusion still counts as correctly placed).`,
      `   - Does it look natural and properly integrated into the scene?`
    )
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
      '  "shot_type_match": "YES",',
      '  "person_prominence": "YES",',
      '  "overall_quality": "YES",',
      '  "branding_placement": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
      '    "shot_type_match": "Image matches medium-shot specification (head to waist)",',
      '    "person_prominence": "Person occupies ~50% of image height and is larger than background elements",',
      '    "branding_placement": "Logo visible and properly placed",',
      '    ...',
      '  }',
      '}'
    )
  } else {
    instructions.push(
      'Example format:',
      '{',
      '  "face_similarity": "YES",',
      '  "characteristic_preservation": "YES",',
      '  "shot_type_match": "YES",',
      '  "person_prominence": "YES",',
      '  "overall_quality": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
      '    "shot_type_match": "Image matches medium-shot specification (head to waist)",',
      '    "person_prominence": "Person occupies ~50% of image height and is larger than background elements",',
      '    ...',
      '  }',
      '}'
    )
  }

  const parts: Part[] = [{ text: instructions.join('\n') }]

  parts.push({ text: 'Final refined image to evaluate' })
  parts.push({ inlineData: { mimeType: 'image/png', data: refinedBase64 } })

  // Pass selfie composite as reference
  parts.push({
    text: selfieComposite.description || 'Selfie composite - Compare the face in the generated image against these reference selfies'
  })
  parts.push({
    inlineData: { mimeType: selfieComposite.mimeType, data: selfieComposite.base64 }
  })

  // Add logo reference if branding evaluation is needed
  if (brandingInfo && logoReference) {
    parts.push({ text: logoReference.description || 'Reference logo for branding evaluation' })
    parts.push({ inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 } })
  }

  const contents: Content[] = [{ role: 'user', parts }]

  if (debugMode) {
    const evalPromptText = instructions.join('\n')
    Logger.info('V3 DEBUG - Step 3 Evaluation Prompt:', {
      step: 3,
      evaluationType: 'final_image',
      prompt: evalPromptText.substring(0, 10000) + (evalPromptText.length > 10000 ? '...(truncated)' : ''),
      promptLength: evalPromptText.length
    })
  }

  let evalDurationMs = 0
  let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined

  const evalStartTime = Date.now()
  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: { temperature: 0.2 }
    })

    evalDurationMs = Date.now() - evalStartTime
    usageMetadata = response.response.usageMetadata
    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''

    // Note: Cost tracking moved to after evaluation status is determined
    // (see below after finalStatus is computed)

    if (textPart) {
      const evaluation = parseFinalEvaluation(textPart)
      if (evaluation) {
        // Auto-reject for critical failures (face/characteristics are non-negotiable)
        const autoReject = [
          evaluation.face_similarity === 'NO',
          evaluation.characteristic_preservation === 'NO'
        ].some(Boolean)

        // Check all required criteria including shot type, prominence, and branding if applicable
        const baseApproved =
          evaluation.face_similarity === 'YES' &&
          evaluation.characteristic_preservation === 'YES' &&
          evaluation.shot_type_match === 'YES' &&
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

        // Log detailed evaluation results
        Logger.debug('V3 Step 3: Final Image Evaluation Details', {
          face_similarity: evaluation.face_similarity,
          characteristic_preservation: evaluation.characteristic_preservation,
          shot_type_match: evaluation.shot_type_match,
          person_prominence: evaluation.person_prominence,
          overall_quality: evaluation.overall_quality,
          branding_placement: evaluation.branding_placement,
          explanations: evaluation.explanations,
          finalStatus,
          autoReject,
          baseApproved,
          brandingApproved
        })

        const finalReason = failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met'

        // Track evaluation cost with outcome
        if (input.onCostTracking && usageMetadata) {
          try {
            await input.onCostTracking({
              stepName: 'step3-final-eval',
              reason: 'evaluation',
              result: 'success',
              model: 'gemini-2.5-flash',
              inputTokens: usageMetadata.promptTokenCount,
              outputTokens: usageMetadata.candidatesTokenCount,
              durationMs: evalDurationMs,
              evaluationStatus: finalStatus === 'Approved' ? 'approved' : 'rejected',
              rejectionReason: finalStatus === 'Not Approved' ? finalReason : undefined,
              intermediateS3Key: input.intermediateS3Key,
            })
            Logger.debug('V3 Step 3: Cost tracking with outcome recorded', {
              generationId: input.generationId,
              evaluationStatus: finalStatus,
              s3Key: input.intermediateS3Key,
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
  } catch (error) {
    const evalDurationMs = Date.now() - evalStartTime
    Logger.error('V3 Step 3: Failed to evaluate final image', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Track failed evaluation cost
    if (input.onCostTracking) {
      try {
        await input.onCostTracking({
          stepName: 'step3-final-eval',
          reason: 'evaluation',
          result: 'failure',
          model: 'gemini-2.5-flash',
          durationMs: evalDurationMs,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 3: Failed to track failed evaluation cost', {
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }

    throw error
  }

  const rejectionReason = 'Evaluation did not return a valid structured response.'
  
  // Track evaluation cost with rejection for parsing failure
  if (input.onCostTracking && usageMetadata) {
    try {
      await input.onCostTracking({
        stepName: 'step3-final-eval',
        reason: 'evaluation',
        result: 'success',
        model: 'gemini-2.5-flash',
        inputTokens: usageMetadata.promptTokenCount,
        outputTokens: usageMetadata.candidatesTokenCount,
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
      shot_type_match: 'YES' | 'NO' | 'UNCERTAIN'
      person_prominence: 'YES' | 'NO' | 'UNCERTAIN'
      overall_quality: 'YES' | 'NO' | 'UNCERTAIN'
      branding_placement?: 'YES' | 'NO' | 'UNCERTAIN'
      explanations: Record<string, string>
    } = {
      face_similarity: normalizeYesNoUncertain(parsed.face_similarity),
      characteristic_preservation: normalizeYesNoUncertain(parsed.characteristic_preservation),
      shot_type_match: normalizeYesNoUncertain(parsed.shot_type_match),
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
      suggestions.push('Improve face matching to selfie references; ensure specific characteristics are preserved')
    }
    if (criterion.includes('characteristic_preservation')) {
      suggestions.push('Maintain unique facial features without beautification or idealization')
    }
    if (criterion.includes('shot_type_match')) {
      suggestions.push('Adjust framing to better match the requested shot type - ensure body is cropped within the appropriate range for the shot type')
    }
    if (criterion.includes('person_prominence')) {
      suggestions.push('Make the person LARGER in the frame - they should occupy at least 40-50% of the image height and be larger than background elements')
    }
    if (criterion.includes('branding_placement')) {
      suggestions.push('Ensure logo is visible and properly placed according to branding specifications')
    }
    if (criterion.includes('overall_quality')) {
      suggestions.push('Improve overall image quality and remove any visible defects')
    }
  }
  
  return suggestions.join('; ')
}
