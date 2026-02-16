import {
  getStep3BrandingAdjustmentSuggestion,
  getStep3BrandingEvalQuestions,
} from '@/domain/style/elements/branding/prompt'

export interface Step3BrandingEvalInfo {
  position?: string
  placement?: string
}

export function buildStep3FinalEvalPrompt(params: {
  prominenceEvalLabel: string
  brandingInfo?: Step3BrandingEvalInfo
  includeBrandingCriterion: boolean
  mustFollowRules: string[]
  freedomRules: string[]
}): string {
  const instructions = [
    'You are evaluating the final refined image for face similarity, characteristic preservation, person prominence, and overall quality.',
    'Answer each question with ONLY: YES (criterion met), NO (criterion failed), UNCERTAIN (cannot determine)',
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
    `   - Is the person the DOMINANT element in the frame (${params.prominenceEvalLabel} of image height)?`,
    '   - Is the person LARGER than background elements (banners, signs, logos)?',
    '',
    '4. overall_quality',
    '   - Is the image professional and high quality?',
    '   - Are there no obvious defects or artifacts?',
  ]

  if (params.includeBrandingCriterion && params.brandingInfo) {
    instructions.push(
      '',
      ...getStep3BrandingEvalQuestions({
        position: params.brandingInfo.position,
        placement: params.brandingInfo.placement,
      }),
    )
  }

  if (params.mustFollowRules.length > 0) {
    instructions.push(
      '',
      'Additional Evaluation Criteria (must follow):',
      ...params.mustFollowRules.map((rule) => `- ${rule}`)
    )
  }

  if (params.freedomRules.length > 0) {
    instructions.push(
      '',
      'Acceptable Variance Guidance:',
      ...params.freedomRules.map((rule) => `- ${rule}`)
    )
  }

  instructions.push(
    '',
    'Return ONLY valid JSON with all fields and explanations.',
    '{',
    '  "face_similarity": "YES",',
    '  "characteristic_preservation": "YES",',
    '  "person_prominence": "YES",',
    '  "overall_quality": "YES",',
    ...(params.includeBrandingCriterion ? ['  "branding_placement": "YES",'] : []),
    '  "explanations": {',
    '    "face_similarity": "Face matches selfie characteristics"',
    '  }',
    '}'
  )

  return instructions.join('\n')
}

export function generateStep3AdjustmentSuggestions(
  failedCriteria: string[],
  prominenceLabel: string
): string {
  const suggestions: string[] = []

  for (const criterion of failedCriteria) {
    if (criterion.includes('face_similarity')) {
      suggestions.push('Improve face matching to selfie references')
    }
    if (criterion.includes('characteristic_preservation')) {
      suggestions.push('Maintain unique facial features without beautification')
    }
    if (criterion.includes('person_prominence')) {
      suggestions.push(`Make person larger (${prominenceLabel} of image height)`)
    }
    if (criterion.includes('branding_placement')) {
      suggestions.push(getStep3BrandingAdjustmentSuggestion())
    }
    if (criterion.includes('overall_quality')) {
      suggestions.push('Improve image quality')
    }
  }

  return suggestions.join('; ')
}
