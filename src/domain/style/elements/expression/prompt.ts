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
 * Get expression label for AI prompt
 */
export function getExpressionLabel(type?: ExpressionType | null): string {
  if (!type) return EXPRESSION_LABELS.neutral_serious
  const expressionType = type as NonNullable<ExpressionType>
  return EXPRESSION_LABELS[expressionType] ?? EXPRESSION_LABELS.neutral_serious
}

