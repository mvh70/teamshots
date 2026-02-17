import type { ExpressionType } from './types'

/**
 * Prompt labels for AI generation
 * These are used in JSON payloads and prompt construction
 * Detailed descriptions help the AI generate accurate facial expressions
 */
export const EXPRESSION_LABELS: Record<ExpressionType, string> = {
  genuine_smile: 'radiant smile showing teeth with crinkling eyes',
  soft_smile: 'gentle closed-mouth smile, lip corners turned slightly up, friendly eyes',
  neutral_serious: 'calm neutral face, completely flat mouth, relaxed open eyes, passport-style',
  laugh_joy: 'candid joyful laugh, head tilted back slightly, eyes narrowed in happiness',
  contemplative: 'pensive intellectual look, focused intense gaze, mouth relaxed but not smiling',
  confident: 'bold confident look, slightly narrowed eyes with lower lid tension, subtle smirk',
  sad: 'somber melancholic expression, subtle frown, eyes looking slightly downward'
}

/**
 * Must-follow rules per expression type.
 * These enforce physical expression requirements that the AI model must obey,
 * preventing pose or tone conflicts from overriding the expression.
 */
export const EXPRESSION_MUST_FOLLOW: Partial<Record<ExpressionType, string[]>> = {
  genuine_smile: [
    'The subject MUST show teeth in a wide, natural smile. Teeth visibility is non-negotiable regardless of head angle or pose.',
    'Eyes must show genuine crinkling (crow\'s feet) consistent with a Duchenne smile.',
  ],
  laugh_joy: [
    'The subject MUST have mouth open showing teeth in a joyful laugh. Teeth and open mouth are required.',
    'Expression must convey genuine spontaneous joy, not a posed smile.',
  ],
  soft_smile: [
    'The mouth MUST be closed with lips together. No teeth visible.',
    'Lip corners must be gently turned upward with a warm, friendly look in the eyes.',
  ],
  neutral_serious: [
    'The mouth MUST be completely flat and closed. No smile, no smirk.',
    'Eyes must be relaxed and open with a calm, neutral gaze.',
  ],
  contemplative: [
    'The mouth must be relaxed and NOT smiling. No upturn at the corners.',
    'The gaze must be focused and intense, conveying deep thought.',
  ],
  confident: [
    'Expression must show a subtle smirk or half-smile only. Not a full smile.',
    'Eyes must be slightly narrowed with lower lid tension conveying self-assurance.',
  ],
  sad: [
    'The mouth must show a subtle downward turn or frown. No smile.',
    'Eyes must look slightly downward conveying a somber, melancholic mood.',
  ],
}

/**
 * Get must-follow rules for an expression type
 */
export function getExpressionMustFollow(type?: ExpressionType | null): string[] {
  if (!type) return EXPRESSION_MUST_FOLLOW.neutral_serious ?? []
  return EXPRESSION_MUST_FOLLOW[type] ?? []
}

/**
 * Get expression label for AI prompt
 */
export function getExpressionLabel(type?: ExpressionType | null): string {
  if (!type) return EXPRESSION_LABELS.neutral_serious
  const expressionType = type as NonNullable<ExpressionType>
  return EXPRESSION_LABELS[expressionType] ?? EXPRESSION_LABELS.neutral_serious
}

