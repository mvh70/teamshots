/**
 * Selfie type classification constants and types
 *
 * Used to classify uploaded selfies into distinct categories
 * for optimal AI headshot generation results.
 */

export const SELFIE_TYPES = [
  'front_view',
  'side_view',
  'partial_body',
  'full_body',
  'unknown',
] as const

export type SelfieType = (typeof SELFIE_TYPES)[number]

export interface SelfieTypeRequirement {
  type: SelfieType
  label: string
  labelKey: string
  description: string
  descriptionKey: string
  recommended: boolean
}

/**
 * Requirements for each selfie type with labels and descriptions.
 * Labels/descriptions are defaults; use i18n keys for localized versions.
 */
export const SELFIE_TYPE_REQUIREMENTS: SelfieTypeRequirement[] = [
  {
    type: 'front_view',
    label: 'Front View',
    labelKey: 'selfie.types.frontView.label',
    description: 'Clear face photo looking at camera',
    descriptionKey: 'selfie.types.frontView.description',
    recommended: true,
  },
  {
    type: 'side_view',
    label: 'Side View',
    labelKey: 'selfie.types.sideView.label',
    description: 'Profile photo showing side of face',
    descriptionKey: 'selfie.types.sideView.description',
    recommended: true,
  },
  {
    type: 'partial_body',
    label: 'Partial Body',
    labelKey: 'selfie.types.partialBody.label',
    description: 'Photo showing head and torso until mid-hip',
    descriptionKey: 'selfie.types.partialBody.description',
    recommended: false,
  },
  {
    type: 'full_body',
    label: 'Full Body',
    labelKey: 'selfie.types.fullBody.label',
    description: 'Photo showing full body from head to feet',
    descriptionKey: 'selfie.types.fullBody.description',
    recommended: true,
  },
]

/**
 * Status of a specific selfie type for a person.
 * Used to track which types have been captured.
 */
export interface SelfieTypeStatus {
  type: SelfieType
  captured: boolean
  selfieId?: string
  confidence?: number
}

/**
 * Quality rating for lighting and background checks.
 * - good: Optimal for AI generation
 * - acceptable: Usable but not ideal
 * - poor: May produce suboptimal results
 */
export type QualityRating = 'good' | 'acceptable' | 'poor'

/**
 * Result from the AI classification service.
 */
export interface ClassificationResult {
  selfieType: SelfieType
  confidence: number
  reasoning?: string
  /** Number of people detected in the photo */
  personCount: number
  /** Whether the selfie is proper for generation (single person, clear face) */
  isProper: boolean
  /** Reason why the selfie is not proper (if isProper is false) */
  improperReason?: string
  /** Lighting quality assessment */
  lightingQuality?: QualityRating
  /** Explanation of lighting issues if not good */
  lightingFeedback?: string
  /** Background separation quality (face stands out from background) */
  backgroundQuality?: QualityRating
  /** Explanation of background issues if not good */
  backgroundFeedback?: string
}

/**
 * Check if a value is a valid SelfieType
 */
export function isValidSelfieType(value: unknown): value is SelfieType {
  return (
    typeof value === 'string' &&
    SELFIE_TYPES.includes(value as SelfieType)
  )
}

/**
 * Get the requirement definition for a selfie type
 */
export function getSelfieTypeRequirement(
  type: SelfieType
): SelfieTypeRequirement | undefined {
  return SELFIE_TYPE_REQUIREMENTS.find((r) => r.type === type)
}

/**
 * Get confidence level label based on score
 */
export function getConfidenceLevel(
  confidence: number
): 'high' | 'medium' | 'low' {
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}
