export interface StructuredEvaluation {
  dimensions_and_aspect_correct: 'YES' | 'NO'
  is_fully_generated: 'YES' | 'NO' | 'UNCERTAIN'
  identity_preserved: 'YES' | 'NO' | 'UNCERTAIN'
  proportions_realistic: 'YES' | 'NO' | 'UNCERTAIN'
  no_unauthorized_add_ons: 'YES' | 'NO' | 'UNCERTAIN'
  no_unauthorized_accessories: 'YES' | 'NO' | 'UNCERTAIN'
  no_visible_reference_labels: 'YES' | 'NO' | 'UNCERTAIN'
  wardrobe_and_colors_match: 'YES' | 'NO' | 'UNCERTAIN'
  explanations: Record<string, string>
}

export interface ImageEvaluationResult {
  status: 'Approved' | 'Not Approved'
  reason: string
  rawResponse?: unknown
  structuredEvaluation?: StructuredEvaluation
  details: {
    actualWidth: number | null
    actualHeight: number | null
    dimensionMismatch: boolean
    aspectMismatch: boolean
    selfieDuplicate: boolean
    matchingReferenceLabel?: string | null
    uncertainCount?: number
    autoReject?: boolean
  }
}
