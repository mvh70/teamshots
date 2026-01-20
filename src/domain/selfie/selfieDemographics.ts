/**
 * Selfie Demographics Aggregation Utility
 *
 * Extracts a consensus demographic profile from multiple selfies.
 * Used to provide context to clothing collage and person generation prompts.
 */

import { prisma } from '@/lib/prisma'
import type { Gender, AgeCategory, Ethnicity, SelfieClassification } from './selfie-types'

/** Minimum confidence threshold for using demographic data */
const CONFIDENCE_THRESHOLD = 0.7

/**
 * Aggregated demographic profile from one or more selfies.
 * Fields are only included if there's sufficient data (not all 'unknown').
 */
export interface DemographicProfile {
  gender?: Exclude<Gender, 'unknown'>
  /** Age range as a string, e.g., "21-30" or "25-40" when combining adjacent categories */
  ageRange?: string
  ethnicity?: Exclude<Ethnicity, 'unknown'>
}

/**
 * Demographic data extracted from a selfie's classification JSON
 */
interface ExtractedDemographics {
  gender?: { value: string; confidence: number }
  ageCategory?: { value: string; confidence: number }
  ethnicity?: { value: string; confidence: number }
}

/**
 * Raw selfie data from database (classification JSON only)
 */
interface SelfieWithClassification {
  classification: unknown | null
}

/**
 * Extract demographics from a selfie's classification JSON.
 */
function extractDemographics(selfie: SelfieWithClassification): ExtractedDemographics {
  if (!selfie.classification || typeof selfie.classification !== 'object') {
    return {}
  }

  const classification = selfie.classification as SelfieClassification
  return classification.demographics || {}
}

/**
 * Age category order for range calculation.
 * Used to find min/max when combining adjacent categories.
 */
const AGE_CATEGORY_ORDER: AgeCategory[] = [
  '16-20',
  '21-30',
  '31-40',
  '41-50',
  '51-60',
  '61-70',
  '70+',
]

/**
 * Parse age category into numeric bounds
 */
function parseAgeBounds(category: string): { min: number; max: number } {
  if (category === '70+') return { min: 70, max: 100 }
  const [min, max] = category.split('-').map(Number)
  return { min, max }
}

/**
 * Aggregate age categories into a combined range.
 * E.g., ['21-30', '31-40'] -> '21-40'
 *
 * Strategy: Find the minimum lower bound and maximum upper bound
 * across all valid categories, then format as a range.
 */
function aggregateAgeCategories(
  ageData: Array<{ value: string; confidence: number }>
): string | undefined {
  // Filter by confidence threshold
  const validData = ageData.filter(
    (d) =>
      d.confidence >= CONFIDENCE_THRESHOLD &&
      AGE_CATEGORY_ORDER.includes(d.value as AgeCategory)
  )

  if (validData.length === 0) return undefined

  // Find min and max bounds across all categories
  let minAge = Infinity
  let maxAge = -Infinity

  for (const { value } of validData) {
    const { min, max } = parseAgeBounds(value)
    if (min < minAge) minAge = min
    if (max > maxAge) maxAge = max
  }

  // Format as range
  if (maxAge >= 100) {
    return `${minAge}+`
  }
  return `${minAge}-${maxAge}`
}

/**
 * Find the mode (most common value) from an array with confidence filtering.
 * Returns undefined if no valid values or no clear winner.
 *
 * @param data - Array of value/confidence pairs
 * @param requireMajority - If true, only return if >50% consensus
 */
function findModeWithConfidence<T extends string>(
  data: Array<{ value: T; confidence: number }>,
  requireMajority = false
): T | undefined {
  // Filter by confidence threshold
  const validData = data.filter((d) => d.confidence >= CONFIDENCE_THRESHOLD)

  if (validData.length === 0) return undefined

  // Count occurrences
  const counts = new Map<T, number>()
  for (const { value } of validData) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }

  // Find mode
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const [mode, count] = sorted[0]

  // Require majority if specified
  if (requireMajority && count <= validData.length / 2) {
    return undefined
  }

  return mode
}

/**
 * Aggregate demographics from multiple selfies into a single profile.
 *
 * Strategy:
 * - Only use values with confidence >= CONFIDENCE_THRESHOLD (0.7)
 * - Gender: Mode (most common), only if majority (>50%)
 * - Age: Combine into a range covering all detected ages (e.g., 21-40)
 * - Ethnicity: Mode (most common), only if majority (>50%)
 *
 * @param selfies - Array of selfie data with classification
 * @returns Aggregated demographic profile (fields omitted if no valid data)
 */
export function aggregateDemographics(selfies: SelfieWithClassification[]): DemographicProfile {
  if (selfies.length === 0) return {}

  // Extract demographics from each selfie (JSON or legacy columns)
  const allDemographics = selfies.map(extractDemographics)

  const profile: DemographicProfile = {}

  // Gender: use mode with majority requirement
  const genderData = allDemographics
    .filter((d) => d.gender)
    .map((d) => d.gender!)
  const gender = findModeWithConfidence(
    genderData as Array<{ value: Exclude<Gender, 'unknown'>; confidence: number }>,
    true // require majority
  )
  if (gender) profile.gender = gender

  // Age: combine into range
  const ageData = allDemographics
    .filter((d) => d.ageCategory)
    .map((d) => d.ageCategory!)
  const ageRange = aggregateAgeCategories(ageData)
  if (ageRange) profile.ageRange = ageRange

  // Ethnicity: use mode with majority requirement
  const ethnicityData = allDemographics
    .filter((d) => d.ethnicity)
    .map((d) => d.ethnicity!)
  const ethnicity = findModeWithConfidence(
    ethnicityData as Array<{ value: Exclude<Ethnicity, 'unknown'>; confidence: number }>,
    true // require majority
  )
  if (ethnicity) profile.ethnicity = ethnicity

  return profile
}

/**
 * Fetch selfie demographics from database and aggregate.
 *
 * @param selfieIds - Array of selfie IDs to fetch
 * @returns Aggregated demographic profile
 */
export async function getDemographicsFromSelfieIds(
  selfieIds: string[]
): Promise<DemographicProfile> {
  if (selfieIds.length === 0) return {}

  const selfies = await prisma.selfie.findMany({
    where: { id: { in: selfieIds } },
    select: {
      classification: true,
    },
  })

  return aggregateDemographics(selfies)
}

/**
 * Fetch selfie demographics by S3 keys and aggregate.
 *
 * @param selfieKeys - Array of selfie S3 keys
 * @returns Aggregated demographic profile
 */
export async function getDemographicsFromSelfieKeys(
  selfieKeys: string[]
): Promise<DemographicProfile> {
  if (selfieKeys.length === 0) return {}

  const selfies = await prisma.selfie.findMany({
    where: { key: { in: selfieKeys } },
    select: {
      classification: true,
    },
  })

  return aggregateDemographics(selfies)
}

/**
 * Check if a demographic profile has any useful data.
 */
export function hasDemographicData(profile: DemographicProfile): boolean {
  return !!(profile.gender || profile.ageRange || profile.ethnicity)
}

/**
 * Format demographic profile for prompt injection.
 * Returns undefined if no data available.
 *
 * @param profile - Demographic profile to format
 * @param purpose - Context for the prompt ('clothing' or 'person')
 */
export function formatDemographicsForPrompt(
  profile: DemographicProfile,
  purpose: 'clothing' | 'person'
): string | undefined {
  if (!hasDemographicData(profile)) return undefined

  const lines: string[] = []

  if (purpose === 'clothing') {
    lines.push('SUBJECT CONTEXT (for appropriate fit and style):')
  } else {
    lines.push('SUBJECT DEMOGRAPHIC GUIDANCE:')
  }

  if (profile.gender) {
    lines.push(`- Gender: ${profile.gender}`)
  }
  if (profile.ageRange) {
    lines.push(`- Age range: ${profile.ageRange}`)
  }
  if (profile.ethnicity) {
    lines.push(`- Ethnicity: ${profile.ethnicity.replace(/_/g, ' ')}`)
  }

  if (purpose === 'clothing') {
    lines.push('Ensure garments are sized and styled appropriately for this demographic.')
  } else {
    lines.push(
      'Use this as supplementary context alongside the selfie references.',
      'The selfies remain the primary source of truth for identity.'
    )
  }

  return lines.join('\n')
}
