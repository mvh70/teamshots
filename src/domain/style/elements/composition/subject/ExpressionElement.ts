/**
 * Expression Element
 *
 * Contributes facial expression rules to person generation.
 * Handles various expressions from genuine smile to contemplative to neutral.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'
import { isUserChoice, hasValue } from '../../base/element-types'
import { EXPRESSION_LABELS } from '../../expression/prompt'

export class ExpressionElement extends StyleElement {
  readonly id = 'expression'
  readonly name = 'Expression'
  readonly description = 'Facial expression and emotional tone'

  // Expression only affects person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no expression configured or user-choice
    if (!settings.expression || isUserChoice(settings.expression) || !hasValue(settings.expression)) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const expression = settings.expression

    // Should not reach here without a valid expression value
    if (!expression || !hasValue(expression)) {
      return { instructions: [], mustFollow: [], payload: {} }
    }

    const exprValue = expression.value

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      expressionType: exprValue.type,
    }

    // Build payload structure for expression
    // Use centralized prompt label from expression/prompt.ts
    const expressionLabel = EXPRESSION_LABELS[exprValue.type] || EXPRESSION_LABELS.neutral_serious

    const payload: Record<string, unknown> = {
      subject: {
        expression: {
          type: exprValue.type,
          description: expressionLabel,
        },
      },
    }

    // Note: Specific expression details are in the JSON payload
    // Only add critical quality rules that aren't obvious from the JSON

    // Add general expression rules
    mustFollow.push(
      'Expression must match the person\'s facial structure naturally',
      'Face must not appear distorted or unnatural',
      'Expression should be appropriate for a professional photograph'
    )

    return {
      instructions,
      mustFollow,
      payload,
      metadata,
    }
  }

  /**
   * Validate expression settings
   */
  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const expression = settings.expression

    if (!expression || !hasValue(expression)) {
      return errors
    }

    const exprValue = expression.value

    // Validate expression type
    const validExpressions = [
      'genuine_smile',
      'soft_smile',
      'neutral_serious',
      'laugh_joy',
      'contemplative',
      'confident',
      'sad'
    ]

    if (exprValue.type && !validExpressions.includes(exprValue.type)) {
      errors.push(`Unknown expression type: ${exprValue.type}`)
    }

    return errors
  }

  // Medium-high priority - expression is key to photo quality
  get priority(): number {
    return 45
  }
}

// Export singleton instance
export const expressionElement = new ExpressionElement()
export default expressionElement

// ===== AUTO-REGISTRATION =====

/**
 * IMPORTANT: Elements self-register on import!
 *
 * When this module is imported, the element automatically registers
 * with the composition registry. No manual registration required!
 */
import { autoRegisterElement } from '../../composition/registry'
autoRegisterElement(expressionElement)
