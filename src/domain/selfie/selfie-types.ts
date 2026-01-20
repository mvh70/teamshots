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
 * Gender classification for demographic analysis.
 */
export const GENDER_OPTIONS = ['male', 'female', 'non_binary', 'unknown'] as const
export type Gender = (typeof GENDER_OPTIONS)[number]

/**
 * Age category ranges for demographic analysis.
 */
export const AGE_CATEGORIES = [
  '16-20',
  '21-30',
  '31-40',
  '41-50',
  '51-60',
  '61-70',
  '70+',
  'unknown',
] as const
export type AgeCategory = (typeof AGE_CATEGORIES)[number]

/**
 * Ethnicity classification for demographic analysis.
 * Uses broad categories for AI generation purposes.
 */
export const ETHNICITY_OPTIONS = [
  'caucasian',
  'black',
  'east_asian',
  'south_asian',
  'southeast_asian',
  'hispanic',
  'middle_eastern',
  'mixed',
  'other',
  'unknown',
] as const
export type Ethnicity = (typeof ETHNICITY_OPTIONS)[number]

/**
 * Result from the AI classification service.
 * @deprecated Use SelfieClassification for new code
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
  /** Detected gender of the person */
  gender?: Gender
  /** Confidence for gender detection (0.0-1.0) */
  genderConfidence?: number
  /** Estimated age category of the person */
  ageCategory?: AgeCategory
  /** Confidence for age category detection (0.0-1.0) */
  ageCategoryConfidence?: number
  /** Detected ethnicity of the person */
  ethnicity?: Ethnicity
  /** Confidence for ethnicity detection (0.0-1.0) */
  ethnicityConfidence?: number
}

/**
 * Structured JSON classification data stored in Selfie.classification column.
 * This is the primary format - individual columns are deprecated.
 */
export interface SelfieClassification {
  /** Schema version for backward compatibility */
  version: 1

  /** Selfie type classification */
  type: {
    value: SelfieType
    confidence: number
  }

  /** Number of people detected in the photo */
  personCount: number

  /** AI reasoning for the classification */
  reasoning?: string

  /** Whether the selfie is proper for generation */
  proper: {
    isProper: boolean
    reason?: string
  }

  /** Lighting quality assessment */
  lighting: {
    quality: QualityRating
    feedback?: string
  }

  /** Background separation quality */
  background: {
    quality: QualityRating
    feedback?: string
  }

  /** Demographic characteristics with per-field confidence */
  demographics: {
    gender?: {
      value: Exclude<Gender, 'unknown'>
      confidence: number
    }
    ageCategory?: {
      value: Exclude<AgeCategory, 'unknown'>
      confidence: number
    }
    ethnicity?: {
      value: Exclude<Ethnicity, 'unknown'>
      confidence: number
    }
  }
}

/**
 * Convert ClassificationResult to SelfieClassification JSON format
 */
export function toSelfieClassification(result: ClassificationResult): SelfieClassification {
  return {
    version: 1,
    type: {
      value: result.selfieType,
      confidence: result.confidence,
    },
    personCount: result.personCount,
    reasoning: result.reasoning,
    proper: {
      isProper: result.isProper,
      reason: result.improperReason,
    },
    lighting: {
      quality: result.lightingQuality ?? 'acceptable',
      feedback: result.lightingFeedback,
    },
    background: {
      quality: result.backgroundQuality ?? 'acceptable',
      feedback: result.backgroundFeedback,
    },
    demographics: {
      ...(result.gender && result.gender !== 'unknown' && {
        gender: {
          value: result.gender as Exclude<Gender, 'unknown'>,
          confidence: result.genderConfidence ?? 0,
        },
      }),
      ...(result.ageCategory && result.ageCategory !== 'unknown' && {
        ageCategory: {
          value: result.ageCategory as Exclude<AgeCategory, 'unknown'>,
          confidence: result.ageCategoryConfidence ?? 0,
        },
      }),
      ...(result.ethnicity && result.ethnicity !== 'unknown' && {
        ethnicity: {
          value: result.ethnicity as Exclude<Ethnicity, 'unknown'>,
          confidence: result.ethnicityConfidence ?? 0,
        },
      }),
    },
  }
}

/**
 * Extracted classification fields in the legacy format.
 * Used for backward compatibility when reading from the classification JSON.
 */
export interface ExtractedClassification {
  selfieType: SelfieType | null
  selfieTypeConfidence: number | null
  personCount: number | null
  isProper: boolean | null
  improperReason: string | null
  lightingQuality: QualityRating | null
  lightingFeedback: string | null
  backgroundQuality: QualityRating | null
  backgroundFeedback: string | null
  gender: Gender | null
  ageCategory: AgeCategory | null
  ethnicity: Ethnicity | null
}

/**
 * Extract individual classification fields from the classification JSON.
 * Returns null values for all fields if classification is null/undefined.
 * 
 * Use this when reading selfie data to get values in the legacy format.
 */
export function extractFromClassification(
  classification: unknown
): ExtractedClassification {
  // Default null values
  const defaults: ExtractedClassification = {
    selfieType: null,
    selfieTypeConfidence: null,
    personCount: null,
    isProper: null,
    improperReason: null,
    lightingQuality: null,
    lightingFeedback: null,
    backgroundQuality: null,
    backgroundFeedback: null,
    gender: null,
    ageCategory: null,
    ethnicity: null,
  }

  if (!classification || typeof classification !== 'object') {
    return defaults
  }

  const c = classification as SelfieClassification

  return {
    selfieType: c.type?.value ?? null,
    selfieTypeConfidence: c.type?.confidence ?? null,
    personCount: c.personCount ?? null,
    isProper: c.proper?.isProper ?? null,
    improperReason: c.proper?.reason ?? null,
    lightingQuality: c.lighting?.quality ?? null,
    lightingFeedback: c.lighting?.feedback ?? null,
    backgroundQuality: c.background?.quality ?? null,
    backgroundFeedback: c.background?.feedback ?? null,
    gender: c.demographics?.gender?.value ?? null,
    ageCategory: c.demographics?.ageCategory?.value ?? null,
    ethnicity: c.demographics?.ethnicity?.value ?? null,
  }
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
