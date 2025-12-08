import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { ImageEvaluationResult } from '../evaluator'
import type { CostTrackingHandler } from '../workflow-v3'

export interface V3Step1bEvalInput {
  backgroundBuffer: Buffer
  backgroundBase64: string
  logoReference?: ReferenceImage // Optional - only required if branding is in background/elements
  generationId: string
  personId?: string // For cost tracking
  teamId?: string // For cost tracking
  intermediateS3Key?: string // S3 key of the image being evaluated
  onCostTracking?: CostTrackingHandler // For cost tracking
}

interface ReferenceImage {
  base64: string
  mimeType: string
  description?: string
}

/**
 * V3 Step 1b Evaluation: Check background quality and optionally logo presence
 * Logo checks are only performed if a logoReference is provided
 */
export async function executeV3Step1bEval(
  input: V3Step1bEvalInput
): Promise<{ evaluation: ImageEvaluationResult }> {
  const {
    backgroundBase64,
    logoReference,
    generationId
  } = input

  const hasLogoReference = !!(logoReference && logoReference.base64)

  Logger.debug('V3 Step 1b Eval: Evaluating background', { 
    generationId,
    hasLogoReference: !!hasLogoReference
  })

  // Build evaluation prompt - conditionally include logo checks
  const basePrompt = `You are a quality control specialist evaluating a generated background image for a professional photo.

Your task is to verify the background quality${hasLogoReference ? ' and that the company logo/branding is present and visible WITHOUT any reference labels or artifacts' : ''}.

EVALUATION CRITERIA:

1. **Background Quality** (CRITICAL):
   - Background should be suitable for compositing a person into it
   - Background should have appropriate depth and realism
   - Background should not contain any people or subjects
   - Background should look professional and well-composed`

  // Add logo-specific criteria only if logo is expected
  const logoCriteria = hasLogoReference ? `

2. **No Reference Labels** (CRITICAL - INSTANT REJECTION):
   - The generated image must NOT contain ANY text labels from the reference composite
   - Look specifically for labels like: "BRANDING LOGO", "LOGO", "BRAND", "CUSTOM BACKGROUND", or any similar text
   - Check for white/colored boxes, borders, or UI elements surrounding the logo that shouldn't be there
   - If ANY reference labels or composite artifacts are visible, the image MUST be rejected immediately
   - The logo should appear clean and natural, as if it were part of the scene, NOT with a label beneath/above it

3. **Logo Presence** (CRITICAL):
   - The logo must be visible somewhere in the background/environment
   - The logo should be clear and recognizable
   - The logo placement should look natural and professional

4. **Logo Exactly Matches Reference** (CRITICAL):
   - Does the logo in the generated image EXACTLY match the provided logo reference?
   - Are ALL letters in the logo text identical to the reference? (same spelling, same font, same case)
   - Are ALL icons/images/symbols in the logo identical to the reference?
   - Are the colors of EACH letter and icon the SAME as the original reference?
   - Is the logo the SAME proportions (aspect ratio) as the reference, not stretched or squished?
   - Are there NO missing elements, NO extra elements, and NO modifications to the logo design?
   - The logo can be partially covered by scene elements (plants, etc.) but visible parts MUST match exactly

5. **Logo Quality**:
   - Logo should not be distorted, blurry, or cut off in a way that makes it unrecognizable
   - Logo should be appropriately sized for the scene
   - Logo should appear naturally integrated, not pasted` : ''

  const responseFormat = hasLogoReference ? `

RESPONSE FORMAT:
Provide your evaluation as a JSON object:
{
  "status": "Approved" or "Not Approved",
  "reason": "Brief explanation of your decision",
  "details": {
    "hasReferenceLabels": true/false,
    "referenceLabelsFound": "list any labels found, or 'none'",
    "logoPresent": true/false,
    "logoMatchesReference": true/false,
    "logoMatchDetails": "describe what matches/doesn't match (letters, colors, icons)",
    "logoQuality": "description of logo quality",
    "backgroundQuality": "description of background quality",
    "hasPeople": true/false
  },
  "suggestedAdjustments": "If not approved, what specific changes should be made?"
}

REJECTION CRITERIA (any of these = REJECT):
- Reference labels visible (e.g., "BRANDING LOGO")
- Logo letters/text don't match reference exactly
- Logo colors significantly different from reference
- Logo icons/symbols missing or modified
- Logo not present at all` : `

RESPONSE FORMAT:
Provide your evaluation as a JSON object:
{
  "status": "Approved" or "Not Approved",
  "reason": "Brief explanation of your decision",
  "details": {
    "backgroundQuality": "description of background quality",
    "hasPeople": true/false
  },
  "suggestedAdjustments": "If not approved, what specific changes should be made?"
}

REJECTION CRITERIA:
- Background contains people or subjects
- Background is unsuitable for compositing (poor quality, unrealistic)`

  const evaluationPrompt = basePrompt + logoCriteria + responseFormat

  const evalStartTime = Date.now()
  try {
    const modelName = Env.string('GEMINI_EVAL_MODEL', Env.string('GEMINI_IMAGE_MODEL'))
    const model = await getVertexGenerativeModel(modelName)

    // Build parts array - conditionally include logo reference
    const parts: Part[] = [
      { text: evaluationPrompt },
      { text: 'Generated Background Image:' },
      { inlineData: { mimeType: 'image/png', data: backgroundBase64 } }
    ]

    // Only add logo reference if provided
    if (hasLogoReference && logoReference) {
      parts.push(
        { text: 'Logo Reference:' },
        { inlineData: { mimeType: logoReference.mimeType, data: logoReference.base64 } }
      )
    }

    const contents: Content[] = [{ role: 'user', parts }]

    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: { temperature: 0.2 }
    })

    const evalDurationMs = Date.now() - evalStartTime
    const usageMetadata = response.response.usageMetadata
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
    
    // Note: Cost tracking moved to after evaluation status is determined
    // (see below after finalStatus is computed)
    
    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse evaluation response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      status: string
      reason: string
      details: {
        hasReferenceLabels?: boolean
        referenceLabelsFound?: string
        logoPresent?: boolean
        logoMatchesReference?: boolean
        logoMatchDetails?: string
        logoQuality?: string
        backgroundQuality?: string
        hasPeople?: boolean
      }
      suggestedAdjustments?: string
    }

    let finalStatus = parsed.status
    let finalReason = parsed.reason
    
    // Only apply logo-specific rejection logic if logo was expected
    if (hasLogoReference) {
      // Force rejection if reference labels are detected (even if model approved)
      const hasReferenceLabels = parsed.details.hasReferenceLabels === true
      // Force rejection if logo doesn't match reference
      const logoMismatch = parsed.details.logoMatchesReference === false
      
      if (hasReferenceLabels) {
        finalStatus = 'Not Approved'
        finalReason = `Reference labels detected in generated image: ${parsed.details.referenceLabelsFound || 'BRANDING LOGO or similar'}. The logo must appear without any labels or UI artifacts.`
      } else if (logoMismatch) {
        finalStatus = 'Not Approved'
        finalReason = `Logo does not match reference: ${parsed.details.logoMatchDetails || 'Letters, colors, or icons differ from the original'}. All elements of the logo must exactly match the reference.`
      }
    }

    const evaluation: ImageEvaluationResult = {
      status: finalStatus as 'Approved' | 'Not Approved',
      reason: finalReason,
      details: {
        actualWidth: null,
        actualHeight: null,
        dimensionMismatch: false,
        aspectMismatch: false,
        selfieDuplicate: false,
        hasReferenceLabels: hasLogoReference ? parsed.details.hasReferenceLabels : undefined,
        logoMatchesReference: hasLogoReference ? (parsed.details.logoMatchesReference !== false) : undefined,
        ...parsed.details
      }
    }
    
    // Add suggested adjustments if present (not part of ImageEvaluationResult type but used by workflow)
    if (parsed.suggestedAdjustments) {
      (evaluation as unknown as Record<string, unknown>).suggestedAdjustments = parsed.suggestedAdjustments
    }

    Logger.debug('V3 Step 1b Eval: Evaluation completed', {
      generationId,
      status: evaluation.status,
      hasLogoReference,
      ...(hasLogoReference ? {
        hasReferenceLabels: parsed.details.hasReferenceLabels,
        referenceLabelsFound: parsed.details.referenceLabelsFound,
        logoMatchesReference: parsed.details.logoMatchesReference,
        logoMatchDetails: parsed.details.logoMatchDetails
      } : {}),
      reasonPreview: evaluation.reason.substring(0, 100)
    })

    // Track evaluation cost with outcome
    if (input.onCostTracking) {
      try {
        await input.onCostTracking({
          stepName: 'step1b-eval',
          reason: 'evaluation',
          result: 'success',
          model: 'gemini-2.5-flash',
          inputTokens: usageMetadata?.promptTokenCount,
          outputTokens: usageMetadata?.candidatesTokenCount,
          durationMs: evalDurationMs,
          evaluationStatus: evaluation.status === 'Approved' ? 'approved' : 'rejected',
          rejectionReason: evaluation.status === 'Not Approved' ? evaluation.reason : undefined,
          intermediateS3Key: input.intermediateS3Key,
        })
        Logger.debug('V3 Step 1b Eval: Cost tracking with outcome recorded', {
          generationId,
          evaluationStatus: evaluation.status,
          s3Key: input.intermediateS3Key,
        })
      } catch (costError) {
        Logger.error('V3 Step 1b Eval: Failed to track evaluation cost', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId,
        })
      }
    }

    return { evaluation }
  } catch (error) {
    const evalDurationMs = Date.now() - evalStartTime
    Logger.error('V3 Step 1b Eval: Evaluation failed', {
      generationId,
      error: error instanceof Error ? error.message : String(error)
    })

    // Track failed evaluation cost
    if (input.onCostTracking) {
      try {
        await input.onCostTracking({
          stepName: 'step1b-eval',
          reason: 'evaluation',
          result: 'failure',
          model: 'gemini-2.5-flash',
          durationMs: evalDurationMs,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 1b Eval: Failed to track failed evaluation cost', {
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }

    throw error
  }
}

