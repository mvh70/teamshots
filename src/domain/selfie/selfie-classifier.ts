/**
 * AI-powered selfie type classification service
 *
 * Uses Google Gemini vision API to classify selfies into:
 * - front_view: Clear face photo looking at camera
 * - side_view: Profile photo showing side of face
 * - full_body: Photo showing full body from head to feet
 */

import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '@/queue/workers/generate-image/gemini'
import type { SelfieType, ClassificationResult } from './selfie-types'

export interface ClassificationInput {
  imageBase64: string
  mimeType: string
}

const CLASSIFICATION_PROMPT = `You are analyzing a selfie photo to classify its type for AI headshot generation.

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

IMPORTANT: Return ONLY valid JSON in this exact format:

Front view example:
{
  "selfie_type": "front_view",
  "confidence": 0.95,
  "person_count": 1,
  "reasoning": "Single person visible. Face pointing straight at camera, both eyes clearly visible, minimal head rotation. Shoulders partially cropped = front_view"
}

Side view example:
{
  "selfie_type": "side_view",
  "confidence": 0.90,
  "person_count": 1,
  "reasoning": "Single person visible. Head turned MORE than 45 degrees to the side (approximately 60 degrees), nose pointing sideways, clear 3/4 profile angle. Shoulders partially cropped = side_view"
}

Partial body example:
{
  "selfie_type": "partial_body",
  "confidence": 0.85,
  "person_count": 1,
  "reasoning": "Single person visible. WIDER framing showing upper body. Can see the full ROUNDED SHAPE of BOTH shoulders within the frame - they are not cut off flat at the edges. The shoulders curve down naturally to meet the upper arms. Frame shows head, complete shoulders, chest, and upper torso. This is an upper body portrait shot, not a tight face close-up = partial_body"
}

Rules:
- person_count: TOTAL people visible in the ENTIRE image (not just one section)
- If image shows multiple photos/panels, count people in ALL of them
- confidence should be 0.0 to 1.0
- KEY DISTINCTION for body shots: Can you see the full ROUNDED SHAPE of both shoulders (not cut off flat at frame edge)? → partial_body. Are shoulders cropped/cut off by the frame edge? → front_view/side_view
- KEY DISTINCTION for angles: Is the head/face rotated MORE than 45 degrees to the side? → side_view. Is head rotation 45 degrees or less? → front_view
- If person_count is 0 or more than 1, set selfie_type to "unknown" and confidence to 0`

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
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.0-flash'

  Logger.debug('Classifying selfie type', {
    mimeType: input.mimeType,
    modelName,
  })

  try {
    const model = await getVertexGenerativeModel(modelName)

    const response = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: CLASSIFICATION_PROMPT },
            {
              inlineData: {
                mimeType: input.mimeType,
                data: input.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for consistent classification
      },
    })

    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''

    const result = parseClassificationResponse(textPart)

    Logger.info('Selfie classified', {
      selfieType: result.selfieType,
      confidence: result.confidence,
      personCount: result.personCount,
      isProper: result.isProper,
      reasoning: result.reasoning,
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

    const selfieType = normalizeSelfieType(parsed.selfie_type)
    const confidence = normalizeConfidence(parsed.confidence)
    const reasoning =
      typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined
    const personCount = normalizePersonCount(parsed.person_count)

    // Determine if selfie is proper for generation
    const { isProper, improperReason } = determineProper(selfieType, personCount)

    return { selfieType, confidence, reasoning, personCount, isProper, improperReason }
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
 * Determine if a selfie is proper for AI headshot generation
 */
function determineProper(
  selfieType: SelfieType,
  personCount: number
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

  // All checks passed
  return { isProper: true }
}
