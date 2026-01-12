import type { ExpressionSettings, ExpressionType, ExpressionValue } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * Valid expression types for validation
 */
const VALID_EXPRESSION_TYPES: readonly string[] = [
  'genuine_smile',
  'soft_smile',
  'neutral_serious',
  'laugh_joy',
  'contemplative',
  'confident',
  'sad'
]

function isValidExpressionType(type: unknown): type is ExpressionType {
  return typeof type === 'string' && VALID_EXPRESSION_TYPES.includes(type)
}

/**
 * Deserializes expression settings from raw data
 *
 * Supports three formats:
 * 1. New format: { mode: 'predefined'|'user-choice', value?: ExpressionValue }
 * 2. Legacy format: { type: 'genuine_smile'|'user-choice'|... }
 * 3. Undefined/null: returns defaults
 */
export function deserialize(
  raw: Record<string, unknown>,
  defaults?: ExpressionSettings
): ExpressionSettings {
  const rawExpression = raw.expression as Record<string, unknown> | undefined

  if (!rawExpression) {
    return defaults || userChoice()
  }

  // Detect new format (has 'mode' field)
  if ('mode' in rawExpression && typeof rawExpression.mode === 'string') {
    const mode = rawExpression.mode as 'predefined' | 'user-choice'
    const value = rawExpression.value as ExpressionValue | undefined
    return { mode, value }
  }

  // Migrate from legacy format (has 'type' field)
  if ('type' in rawExpression && typeof rawExpression.type === 'string') {
    const legacyType = rawExpression.type as string

    // Legacy user-choice
    if (legacyType === 'user-choice') {
      return userChoice()
    }

    // Valid expression type
    if (isValidExpressionType(legacyType)) {
      return predefined({ type: legacyType })
    }
  }

  return defaults || userChoice()
}
