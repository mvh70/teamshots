import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import { AI_CONFIG } from '../config'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { ReferenceImage, EvaluationFeedback } from '@/types/generation'

const DIMENSION_TOLERANCE_PX = 50 // Generous tolerance for model variations
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance

export async function evaluateFinalImage(
  imageBase64: string,
  selfieReferences: ReferenceImage[],
  actualWidth: number | null,
  actualHeight: number | null,
  expectedWidth: number,
  expectedHeight: number,
  aspectRatioId: string,
  debugMode = false,
  logoReference?: ReferenceImage,
  brandingInfo?: { position?: string; placement?: string }
): Promise<EvaluationFeedback> {
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
  Logger.debug('Evaluating final image (Step 8)', { modelName })
  
  // Calculate dimension and aspect ratio checks
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

  // Check for selfie duplicate
  const matchingReference = selfieReferences.find((selfie) => selfie.base64 === imageBase64)
  const selfieDuplicate = Boolean(matchingReference)

  // Auto-reject if dimension/aspect fails or selfie duplicate
  if (dimensionMismatch || aspectMismatch) {
    const dimIssue = dimensionMismatch
      ? `Dimension mismatch (expected ${expectedWidth}x${expectedHeight}px, actual ${actualWidth ?? 'unknown'}x${actualHeight ?? 'unknown'}px)`
      : ''
    const aspectIssue = aspectMismatch
      ? `Aspect ratio mismatch (expected ${aspectRatioId} ≈${expectedRatio.toFixed(4)}, actual ${
          actualRatio !== null ? actualRatio.toFixed(4) : 'unknown'
        })`
      : ''
    const reason = [dimIssue, aspectIssue].filter(Boolean).join('; ')
    
    Logger.warn('Step 8: Dimension/aspect check failed', { reason })
    
    return {
      status: 'Not Approved',
      reason,
      failedCriteria: [reason]
    }
  }

  if (selfieDuplicate) {
    const reason = `Generated image matches reference selfie ${matchingReference?.description ?? 'unknown'} exactly (base64 match)`
    
    Logger.warn('Step 8: Selfie duplicate detected', { reason })
    
    return {
      status: 'Not Approved',
      reason,
      failedCriteria: [reason]
    }
  }
  
  const model = await getVertexGenerativeModel(modelName)

  const instructions = [
    `You are evaluating the final refined image for face similarity and overall quality.`,
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
    '3. overall_quality',
    '   - Is the image professional and high quality?',
    '   - Are there no obvious defects or artifacts?',
    '   - Does the composition work well overall?'
  ]

  // Add branding evaluation if applicable
  if (brandingInfo && logoReference) {
    instructions.push(
      '',
      '4. branding_placement',
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
      '  "overall_quality": "YES",',
      '  "branding_placement": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
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
      '  "overall_quality": "YES",',
      '  "explanations": {',
      '    "face_similarity": "Face matches selfie characteristics",',
      '    ...',
      '  }',
      '}'
    )
  }

  const parts: Part[] = [{ text: instructions.join('\n') }]

  parts.push({ text: 'Final refined image to evaluate' })
  parts.push({ inlineData: { mimeType: 'image/png', data: imageBase64 } })

  for (const selfie of selfieReferences) {
    parts.push({ text: `Reference ${selfie.description || 'selfie'}` })
    parts.push({ inlineData: { mimeType: selfie.mimeType, data: selfie.base64 } })
  }

  // Add logo reference if branding evaluation is needed
  if (brandingInfo && logoReference) {
    parts.push({ text: logoReference.description || 'Reference logo for branding evaluation' })
    parts.push({ inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 } })
  }

  const contents: Content[] = [{ role: 'user', parts }]

  if (debugMode) {
    const evalPromptText = instructions.join('\n')
    Logger.info('V2 DEBUG - Step 8 Evaluation Prompt:', {
      step: 8,
      evaluationType: 'final_image',
      prompt: evalPromptText.substring(0, 3000) + (evalPromptText.length > 3000 ? '...(truncated)' : ''),
      promptLength: evalPromptText.length,
      imageCount: 1,
      selfieCount: selfieReferences.length
    })
  }

  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: { temperature: AI_CONFIG.EVALUATION_TEMPERATURE }
    })

    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''

    if (textPart) {
      const evaluation = parseFinalEvaluation(textPart)
      if (evaluation) {
        const autoReject = [
          evaluation.face_similarity === 'NO',
          evaluation.characteristic_preservation === 'NO'
        ].some(Boolean)

        // Check all required criteria including branding if applicable
        const baseApproved =
          evaluation.face_similarity === 'YES' &&
          evaluation.characteristic_preservation === 'YES' &&
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
        Logger.info('Final Image Evaluation Details', {
          face_similarity: evaluation.face_similarity,
          characteristic_preservation: evaluation.characteristic_preservation,
          overall_quality: evaluation.overall_quality,
          branding_placement: evaluation.branding_placement,
          explanations: evaluation.explanations,
          finalStatus,
          autoReject,
          baseApproved,
          brandingApproved
        })

        return {
          status: finalStatus,
          reason: failedCriteria.length > 0 ? failedCriteria.join(' | ') : 'All criteria met',
          failedCriteria: failedCriteria.length > 0 ? failedCriteria : undefined,
          suggestedAdjustments: finalStatus === 'Not Approved' ? generateAdjustmentSuggestions(failedCriteria) : undefined
        }
      }
    }
  } catch (error) {
    Logger.error('Failed to evaluate final image', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }

  return {
    status: 'Not Approved',
    reason: 'Evaluation did not return a valid structured response.'
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
      overall_quality: 'YES' | 'NO' | 'UNCERTAIN'
      branding_placement?: 'YES' | 'NO' | 'UNCERTAIN'
      explanations: Record<string, string>
    } = {
      face_similarity: normalizeYesNoUncertain(parsed.face_similarity),
      characteristic_preservation: normalizeYesNoUncertain(parsed.characteristic_preservation),
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
    if (criterion.includes('branding_placement')) {
      suggestions.push('Ensure logo is visible and properly placed according to branding specifications')
    }
    if (criterion.includes('overall_quality')) {
      suggestions.push('Improve overall image quality and remove any visible defects')
    }
  }
  
  return suggestions.join('; ')
}

