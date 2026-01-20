/**
 * AI-powered selfie type classification service
 *
 * Uses Google Gemini vision API to classify selfies into:
 * - front_view: Clear face photo looking at camera
 * - side_view: Profile photo showing side of face
 * - full_body: Photo showing full body from head to feet
 */

import { Logger } from '@/lib/logger'
import { generateTextWithGemini } from '@/queue/workers/generate-image/gemini'
import { STAGE_MODEL } from '@/queue/workers/generate-image/config'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { classificationQueue } from '@/lib/classification-queue'
import { toSelfieClassification } from './selfie-types'
import type { SelfieType, ClassificationResult, QualityRating, Gender, AgeCategory, Ethnicity } from './selfie-types'

export interface ClassificationInput {
  imageBase64: string
  mimeType: string
}

const CLASSIFICATION_PROMPT = `You are analyzing a selfie photo to classify its type and quality for AI headshot generation.

STEP 1: Count the TOTAL number of people/faces visible in the ENTIRE image.
CRITICAL: Count EVERY person you can see anywhere in the image. This includes:
- People in the background
- People in different sections if the image has multiple photos/panels
- Same person appearing multiple times counts as multiple
- Even small or partially visible faces count
DO NOT pick one area to analyze - scan the ENTIRE image and count ALL people.

STEP 2: If exactly 1 person total, classify the photo into ONE of these categories:

1. front_view - Face clearly visible from straight-on - FACE CLOSE-UP
   - Both eyes clearly visible and looking roughly toward camera
   - Nose pointing directly at or nearly at the camera
   - Face is centered and symmetrical in the frame
   - Face is the PRIMARY focus taking up majority of the frame
   - Head rotation is 45 degrees or less
   - Shoulders may be partially visible BUT are CUT OFF FLAT at the frame edges (not showing the full rounded shoulder shape)
   - The framing is a CLOSE-UP of the face/head, zoomed in on facial features
   When the photo is mid-torso, with both shoulders visible and not cut off at the frame edges, it is a partial_body

2. side_view - Profile or angled view showing side of face
   - Head is turned MORE than 45 degrees to the left or right
   - Can be 3/4 profile (head turned ~50-70 degrees) OR full profile (90 degrees)
   - For 3/4 profile: nose is pointing noticeably to the side, may see both eyes but from an angle
   - For full profile: only one eye visible, clear profile of nose and chin
   - Face is the PRIMARY focus taking up majority of the frame
   - Shoulders may be visible but are cropped/cut off at the frame edges
   - The framing is a close-up of the face/profile, not a wider portrait
   - KEY: If the head/face is rotated MORE than 45 degrees → side_view

3. partial_body - Photo showing head and upper body (torso) - WIDER FRAMING
   - The frame shows MORE than just the face - it includes significant upper body/torso
   - BOTH shoulders are COMPLETE and visible within the frame (not cut off at the edges)
   - The shoulder's rounded shape is fully visible - you can see where the shoulder curves down to meet the arm
   - The frame typically cuts off somewhere between the shoulders and elbows (showing upper arms)
   - Shows: head + complete shoulders + chest + upper torso
   - Cuts off at or above mid-hip level
   - Does NOT show legs or feet
   - This is a WIDER "upper body portrait" shot, not a tight face close-up
   - SIMPLE TEST: Can you see the full rounded shape of BOTH shoulders? YES = partial_body. Are the shoulders cut off at the frame edge (flat crop)? = front_view/side_view
   - The framing is deliberately wider to show the torso, not zoomed in on the face

4. full_body - Photo showing the body below mid-hip
   - Shows legs, thighs, or any body part below mid-hip
   - Can see head, torso, AND lower body in same frame
   - If you can see knees, thighs, or feet = full_body
   - MUST show BOTH shoulders FULLY visible with clear space around them

5. unknown - Cannot determine (multiple people, no face, too blurry)

STEP 3: Assess LIGHTING QUALITY (for single-person photos only):

Evaluate the lighting on the face:
- "good": Even, well-lit face. Soft shadows. No harsh shadows on face. Face is clearly visible without squinting or overexposure.
- "acceptable": Minor lighting issues but face details are still visible. Slight shadows under eyes/nose, or slightly overexposed areas, but overall usable.
- "poor": Significant lighting problems - harsh shadows obscuring facial features, severe backlighting (face in shadow), extreme overexposure washing out features, or very dark/underexposed where face details are lost.

Provide brief feedback if not "good" (e.g., "harsh shadow on left side of face", "backlit - face in shadow", "overexposed highlights").

STEP 4: Assess BACKGROUND SEPARATION (for single-person photos only):

Evaluate how well the face/person stands out from the background:
- "good": Clear separation between person and background. Face is distinct and easy to identify. Background doesn't merge with hair, skin, or clothing.
- "acceptable": Mostly clear separation with minor issues. Some areas where background blends slightly with subject, but face is still clearly distinguishable.
- "poor": Significant separation issues - background color similar to hair/skin making edges unclear, very busy/cluttered background that distracts from face, or subject blends into background making face boundaries unclear.

Provide brief feedback if not "good" (e.g., "hair blends with dark background", "busy background distracts from face", "similar colors make edges unclear").

STEP 5: Assess DEMOGRAPHIC CHARACTERISTICS (for single-person photos only):

For each demographic field, provide BOTH a value AND a confidence score (0.0 to 1.0).
The confidence indicates how certain you are about the assessment.

a) GENDER - Estimate the apparent gender:
- value: "male", "female", "non_binary", or "unknown"
- confidence: 0.0 to 1.0 (how certain you are)

b) AGE CATEGORY - Estimate the apparent age range:
- value: "16-20", "21-30", "31-40", "41-50", "51-60", "61-70", "70+", or "unknown"
- confidence: 0.0 to 1.0

c) ETHNICITY - Estimate the apparent ethnicity:
- value: "caucasian", "black", "east_asian", "south_asian", "southeast_asian", "hispanic", "middle_eastern", "mixed", "other", or "unknown"
- confidence: 0.0 to 1.0

IMPORTANT: Return ONLY valid JSON in this exact format:

Example with all fields and confidence:
{
  "selfie_type": "front_view",
  "confidence": 0.95,
  "person_count": 1,
  "reasoning": "Single person visible. Face pointing straight at camera, both eyes clearly visible, minimal head rotation. Shoulders partially cropped = front_view",
  "lighting_quality": "good",
  "lighting_feedback": null,
  "background_quality": "acceptable",
  "background_feedback": "Slightly busy background but face is clearly visible",
  "gender": "female",
  "gender_confidence": 0.95,
  "age_category": "31-40",
  "age_category_confidence": 0.75,
  "ethnicity": "caucasian",
  "ethnicity_confidence": 0.88
}

Example with lower confidence:
{
  "selfie_type": "front_view",
  "confidence": 0.90,
  "person_count": 1,
  "reasoning": "Single person, face forward",
  "lighting_quality": "poor",
  "lighting_feedback": "Strong backlight causes face to be in shadow",
  "background_quality": "good",
  "background_feedback": null,
  "gender": "male",
  "gender_confidence": 0.92,
  "age_category": "21-30",
  "age_category_confidence": 0.60,
  "ethnicity": "east_asian",
  "ethnicity_confidence": 0.85
}

Rules:
- person_count: TOTAL people visible in the ENTIRE image (not just one section)
- If image shows multiple photos/panels, count people in ALL of them
- confidence should be 0.0 to 1.0
- lighting_quality and background_quality: must be "good", "acceptable", or "poor"
- lighting_feedback and background_feedback: provide brief explanation if quality is not "good", otherwise null
- gender: must be "male", "female", "non_binary", or "unknown"
- gender_confidence: 0.0 to 1.0 (required when gender is not "unknown")
- age_category: must be "16-20", "21-30", "31-40", "41-50", "51-60", "61-70", "70+", or "unknown"
- age_category_confidence: 0.0 to 1.0 (required when age_category is not "unknown")
- ethnicity: must be "caucasian", "black", "east_asian", "south_asian", "southeast_asian", "hispanic", "middle_eastern", "mixed", "other", or "unknown"
- ethnicity_confidence: 0.0 to 1.0 (required when ethnicity is not "unknown")
- KEY DISTINCTION for body shots: Can you see the full ROUNDED SHAPE of both shoulders (not cut off flat at frame edge)? → partial_body. Are shoulders cropped/cut off by the frame edge? → front_view/side_view
- KEY DISTINCTION for angles: Is the head/face rotated MORE than 45 degrees to the side? → side_view. Is head rotation 45 degrees or less? → front_view
- If person_count is 0 or more than 1, set selfie_type to "unknown", confidence to 0, and skip lighting/background/demographic assessment`

/**
 * Classify a selfie image using Gemini vision API.
 * Returns the detected type with confidence score.
 *
 * @param input - Base64 encoded image and MIME type
 * @returns Classification result with type, confidence, and reasoning
 */
export async function classifySelfieType(
  input: ClassificationInput
): Promise<ClassificationResult> {
  const modelName = STAGE_MODEL.SELFIE_CLASSIFICATION

  Logger.debug('Classifying selfie type', {
    mimeType: input.mimeType,
    modelName,
  })

  try {
    // Use multi-provider fallback stack for classification
    const response = await generateTextWithGemini(
      CLASSIFICATION_PROMPT,
      [
        {
          mimeType: input.mimeType,
          base64: input.imageBase64,
          description: 'Selfie image to classify',
        },
      ],
      {
        temperature: 0.2, // Low temperature for consistent classification
        stage: 'SELFIE_CLASSIFICATION',
      }
    )

    const textPart = response.text

    // Log response details for debugging
    Logger.debug('Gemini classification response details', {
      provider: response.providerUsed,
      responseLength: textPart.length,
      durationMs: response.usage.durationMs,
    })

    if (!textPart) {
      Logger.warn('Empty response from Gemini classification', {
        provider: response.providerUsed,
      })
    }

    const result = parseClassificationResponse(textPart)

    Logger.info('Selfie classified', {
      provider: response.providerUsed,
      selfieType: result.selfieType,
      confidence: result.confidence,
      personCount: result.personCount,
      isProper: result.isProper,
      improperReason: result.improperReason,
      reasoning: result.reasoning,
      lightingQuality: result.lightingQuality,
      backgroundQuality: result.backgroundQuality,
      gender: result.gender,
      genderConfidence: result.genderConfidence,
      ageCategory: result.ageCategory,
      ageCategoryConfidence: result.ageCategoryConfidence,
      ethnicity: result.ethnicity,
      ethnicityConfidence: result.ethnicityConfidence,
    })

    return result
  } catch (error) {
    Logger.error('Selfie classification failed', {
      error: error instanceof Error ? error.message : String(error),
    })

    // Graceful degradation - return unknown instead of throwing
    return {
      selfieType: 'unknown',
      confidence: 0,
      reasoning: 'Classification failed due to an error',
      personCount: 0,
      isProper: false,
      improperReason: 'Classification failed',
    }
  }
}

/**
 * Parse the JSON response from Gemini into a ClassificationResult
 */
function parseClassificationResponse(text: string): ClassificationResult {
  const trimmed = text.trim()

  // Log raw response for debugging
  Logger.debug('Raw classification response', { response: trimmed.substring(0, 500) })

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)

  if (!jsonMatch) {
    Logger.warn('No JSON found in classification response', { response: text })
    return {
      selfieType: 'unknown',
      confidence: 0,
      reasoning: 'No valid response from classifier',
      personCount: 0,
      isProper: false,
      improperReason: 'No valid response from classifier',
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Log parsed JSON for debugging
    Logger.debug('Parsed classification JSON', {
      selfie_type: parsed.selfie_type,
      confidence: parsed.confidence,
      person_count: parsed.person_count,
      lighting_quality: parsed.lighting_quality,
      background_quality: parsed.background_quality,
      gender: parsed.gender,
      gender_confidence: parsed.gender_confidence,
      age_category: parsed.age_category,
      age_category_confidence: parsed.age_category_confidence,
      ethnicity: parsed.ethnicity,
      ethnicity_confidence: parsed.ethnicity_confidence,
    })

    const selfieType = normalizeSelfieType(parsed.selfie_type)
    const confidence = normalizeConfidence(parsed.confidence)
    const reasoning =
      typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined
    const personCount = normalizePersonCount(parsed.person_count)

    // Parse quality assessments
    const lightingQuality = normalizeQualityRating(parsed.lighting_quality)
    const lightingFeedback =
      typeof parsed.lighting_feedback === 'string' ? parsed.lighting_feedback : undefined
    const backgroundQuality = normalizeQualityRating(parsed.background_quality)
    const backgroundFeedback =
      typeof parsed.background_feedback === 'string' ? parsed.background_feedback : undefined

    // Parse demographic characteristics with per-field confidence
    const gender = normalizeGender(parsed.gender)
    const genderConfidence = normalizeConfidence(parsed.gender_confidence)
    const ageCategory = normalizeAgeCategory(parsed.age_category)
    const ageCategoryConfidence = normalizeConfidence(parsed.age_category_confidence)
    const ethnicity = normalizeEthnicity(parsed.ethnicity)
    const ethnicityConfidence = normalizeConfidence(parsed.ethnicity_confidence)

    // Determine if selfie is proper for generation
    const { isProper, improperReason } = determineProper(
      selfieType,
      personCount,
      lightingQuality,
      backgroundQuality
    )

    return {
      selfieType,
      confidence,
      reasoning,
      personCount,
      isProper,
      improperReason,
      lightingQuality,
      lightingFeedback,
      backgroundQuality,
      backgroundFeedback,
      gender,
      genderConfidence,
      ageCategory,
      ageCategoryConfidence,
      ethnicity,
      ethnicityConfidence,
    }
  } catch (error) {
    Logger.warn('Failed to parse classification JSON', {
      error: error instanceof Error ? error.message : String(error),
      response: text,
    })

    return {
      selfieType: 'unknown',
      confidence: 0,
      reasoning: 'Failed to parse classifier response',
      personCount: 0,
      isProper: false,
      improperReason: 'Failed to parse classifier response',
    }
  }
}

/**
 * Normalize the selfie_type field to a valid SelfieType
 */
function normalizeSelfieType(value: unknown): SelfieType {
  if (typeof value !== 'string') return 'unknown'

  const normalized = value.trim().toLowerCase().replace(/[\s-]/g, '_')

  switch (normalized) {
    case 'front_view':
    case 'frontview':
    case 'front':
      return 'front_view'
    case 'side_view':
    case 'sideview':
    case 'side':
    case 'profile':
      return 'side_view'
    case 'partial_body':
    case 'partialbody':
    case 'partial':
    case 'half_body':
    case 'halfbody':
    case 'upper_body':
    case 'upperbody':
    case 'torso':
      return 'partial_body'
    case 'full_body':
    case 'fullbody':
    case 'full':
    case 'body':
      return 'full_body'
    default:
      return 'unknown'
  }
}

/**
 * Normalize confidence score to 0.0-1.0 range
 */
function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number') {
    if (typeof value === 'string') {
      const parsed = parseFloat(value)
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(1, parsed))
      }
    }
    return 0
  }

  return Math.max(0, Math.min(1, value))
}

/**
 * Normalize person_count to a non-negative integer
 */
function normalizePersonCount(value: unknown): number {
  if (typeof value === 'number') {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    if (!isNaN(parsed)) {
      return Math.max(0, parsed)
    }
  }
  // Default to 1 if not specified (assume single person for backwards compatibility)
  return 1
}

/**
 * Normalize quality rating to valid QualityRating or undefined
 */
function normalizeQualityRating(value: unknown): QualityRating | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()

  switch (normalized) {
    case 'good':
      return 'good'
    case 'acceptable':
    case 'ok':
    case 'okay':
    case 'medium':
      return 'acceptable'
    case 'poor':
    case 'bad':
    case 'low':
      return 'poor'
    default:
      return undefined
  }
}

/**
 * Normalize gender to valid Gender or undefined
 */
function normalizeGender(value: unknown): Gender | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase().replace(/[\s-]/g, '_')

  switch (normalized) {
    case 'male':
    case 'm':
    case 'man':
      return 'male'
    case 'female':
    case 'f':
    case 'woman':
      return 'female'
    case 'non_binary':
    case 'nonbinary':
    case 'nb':
    case 'other':
      return 'non_binary'
    case 'unknown':
      return 'unknown'
    default:
      return undefined
  }
}

/**
 * Normalize age category to valid AgeCategory or undefined
 */
function normalizeAgeCategory(value: unknown): AgeCategory | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()

  switch (normalized) {
    case '16-20':
    case '16_20':
    case 'teenager':
    case 'teen':
      return '16-20'
    case '21-30':
    case '21_30':
    case '20s':
      return '21-30'
    case '31-40':
    case '31_40':
    case '30s':
      return '31-40'
    case '41-50':
    case '41_50':
    case '40s':
      return '41-50'
    case '51-60':
    case '51_60':
    case '50s':
      return '51-60'
    case '61-70':
    case '61_70':
    case '60s':
      return '61-70'
    case '70+':
    case '70_plus':
    case '71+':
    case 'elderly':
    case 'senior':
      return '70+'
    case 'unknown':
      return 'unknown'
    default:
      return undefined
  }
}

/**
 * Normalize ethnicity to valid Ethnicity or undefined
 */
function normalizeEthnicity(value: unknown): Ethnicity | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase().replace(/[\s-]/g, '_')

  switch (normalized) {
    case 'caucasian':
    case 'white':
    case 'european':
      return 'caucasian'
    case 'black':
    case 'african':
    case 'african_american':
      return 'black'
    case 'east_asian':
    case 'asian':
    case 'chinese':
    case 'japanese':
    case 'korean':
      return 'east_asian'
    case 'south_asian':
    case 'indian':
    case 'pakistani':
    case 'bengali':
    case 'sri_lankan':
      return 'south_asian'
    case 'southeast_asian':
    case 'thai':
    case 'vietnamese':
    case 'filipino':
    case 'indonesian':
    case 'malaysian':
      return 'southeast_asian'
    case 'hispanic':
    case 'latino':
    case 'latina':
    case 'latin':
      return 'hispanic'
    case 'middle_eastern':
    case 'arab':
    case 'persian':
    case 'north_african':
      return 'middle_eastern'
    case 'mixed':
    case 'multiracial':
      return 'mixed'
    case 'other':
      return 'other'
    case 'unknown':
      return 'unknown'
    default:
      return undefined
  }
}

/**
 * Determine if a selfie is proper for AI headshot generation.
 * Quality assessments (lighting, background) are surfaced as feedback
 * but don't block the selfie from being used.
 */
function determineProper(
  selfieType: SelfieType,
  personCount: number,
  _lightingQuality?: QualityRating,
  _backgroundQuality?: QualityRating
): { isProper: boolean; improperReason?: string } {
  // Check for multiple people
  if (personCount > 1) {
    return {
      isProper: false,
      improperReason: `Multiple people detected (${personCount}). Please upload a photo with only yourself.`,
    }
  }

  // Check for no people detected
  if (personCount === 0) {
    return {
      isProper: false,
      improperReason: 'No person detected in the photo. Please upload a clear photo of yourself.',
    }
  }

  // Check for unknown type (likely blurry or no face)
  if (selfieType === 'unknown') {
    return {
      isProper: false,
      improperReason: 'Could not detect a clear face. Please upload a clearer photo.',
    }
  }

  // Quality assessments are surfaced as feedback (lightingFeedback, backgroundFeedback)
  // but don't block the selfie from being used - users can decide based on the feedback

  // All checks passed
  return { isProper: true }
}

// ============================================================================
// CENTRALIZED CLASSIFICATION SERVICE
// ============================================================================

export interface ClassifyAndUpdateInput {
  selfieId: string
  imageBase64: string
  mimeType: string
}

export interface ClassifyAndUpdateResult {
  success: boolean
  classification?: ClassificationResult
  error?: string
}

/**
 * Classify a selfie and update the database with results.
 * 
 * This is the SINGLE source of truth for classification + database updates.
 * All routes should use this function instead of duplicating the logic.
 * 
 * Updates both:
 * - The new `classification` JSON column (primary)
 * - Legacy individual columns (for backward compatibility)
 */
export async function classifyAndUpdateSelfie(
  input: ClassifyAndUpdateInput
): Promise<ClassifyAndUpdateResult> {
  const { selfieId, imageBase64, mimeType } = input

  try {
    Logger.info('[classifyAndUpdateSelfie] Starting classification', { selfieId })

    // Run classification
    const classification = await classifySelfieType({ imageBase64, mimeType })

    // Convert to JSON format for the classification column
    const classificationJson = toSelfieClassification(classification)

    // Update database with classification JSON
    await prisma.selfie.update({
      where: { id: selfieId },
      data: {
        classification: classificationJson as unknown as Prisma.InputJsonValue,
        // TODO: Re-enable when classification is reliable
        // If improper, deselect the selfie
        // ...(classification.isProper === false && { selected: false }),
      },
    })

    Logger.info('[classifyAndUpdateSelfie] Classification complete', {
      selfieId,
      selfieType: classification.selfieType,
      isProper: classification.isProper,
      personCount: classification.personCount,
      gender: classification.gender,
      ageCategory: classification.ageCategory,
      ethnicity: classification.ethnicity,
    })

    return { success: true, classification }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error('[classifyAndUpdateSelfie] Classification failed', {
      selfieId,
      error: errorMessage,
    })

    // Mark as null to allow retry
    try {
      await prisma.selfie.update({
        where: { id: selfieId },
        data: {
          classification: Prisma.DbNull,
        },
      })
    } catch {}

    return { success: false, error: errorMessage }
  }
}

/**
 * Queue a selfie for classification (fire-and-forget).
 * 
 * Uses the global classification queue to limit concurrent requests
 * and prevent rate limiting from the Gemini API.
 * 
 * @param input - Classification input with selfie ID and image data
 * @param source - Optional source identifier for logging (e.g., 'promote', 'type-status')
 */
export function queueClassification(
  input: ClassifyAndUpdateInput,
  source: string = 'unknown'
): void {
  const { selfieId } = input

  classificationQueue.enqueue(async () => {
    await classifyAndUpdateSelfie(input)
  }, selfieId).catch((error) => {
    Logger.error('[queueClassification] Queue error', {
      selfieId,
      source,
      error: error instanceof Error ? error.message : String(error),
    })
  })

  // Log queue status for monitoring
  const queueStatus = classificationQueue.getStatus()
  Logger.debug('[queueClassification] Classification queued', {
    selfieId,
    source,
    queueStatus,
  })
}

export interface QueueClassificationFromS3Input {
  selfieId: string
  selfieKey: string
  bucketName: string
  s3Client: import('@aws-sdk/client-s3').S3Client
}

/**
 * Queue a selfie for classification by downloading from S3 first (fire-and-forget).
 * 
 * Use this when you have a selfie key but not the image data.
 * 
 * @param input - Input with selfie ID, S3 key, and S3 client
 * @param source - Optional source identifier for logging
 */
export function queueClassificationFromS3(
  input: QueueClassificationFromS3Input,
  source: string = 'unknown'
): void {
  const { selfieId, selfieKey, bucketName, s3Client: s3 } = input

  // Import dynamically to avoid circular dependencies
  classificationQueue.enqueue(async () => {
    try {
      // Download image from S3
      const { downloadSelfieAsBase64 } = await import('@/queue/workers/generate-image/s3-utils')
      const imageData = await downloadSelfieAsBase64({
        bucketName,
        s3Client: s3,
        key: selfieKey,
      })

      // Run classification
      await classifyAndUpdateSelfie({
        selfieId,
        imageBase64: imageData.base64,
        mimeType: imageData.mimeType,
      })
    } catch (error) {
      Logger.error('[queueClassificationFromS3] Failed', {
        selfieId,
        source,
        error: error instanceof Error ? error.message : String(error),
      })

      // Mark as null to allow retry
      try {
        await prisma.selfie.update({
          where: { id: selfieId },
          data: {
            classification: Prisma.DbNull,
          },
        })
      } catch {}
    }
  }, selfieId).catch((error) => {
    Logger.error('[queueClassificationFromS3] Queue error', {
      selfieId,
      source,
      error: error instanceof Error ? error.message : String(error),
    })
  })

  // Log queue status for monitoring
  const queueStatus = classificationQueue.getStatus()
  Logger.debug('[queueClassificationFromS3] Classification queued', {
    selfieId,
    source,
    queueStatus,
  })
}
