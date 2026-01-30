/**
 * Expression Element
 *
 * Contributes facial expression rules to person generation.
 * Handles various expressions from genuine smile to contemplative to neutral.
 */

import { StyleElement, ElementContext, ElementContribution } from '../base/StyleElement'
import { hasValue } from '../base/element-types'
import { EXPRESSION_LABELS } from './prompt'
import { autoRegisterElement } from '../composition/registry'

export class ExpressionElement extends StyleElement {
  readonly id = 'expression'
  readonly name = 'Expression'
  readonly description = 'Facial expression and emotional tone'

  // Expression only affects person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no expression configured or no value set
    if (!settings.expression || !hasValue(settings.expression)) {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const expression = settings.expression

    if (!expression || !hasValue(expression)) {
      return { instructions: [], mustFollow: [], payload: {} }
    }

    const exprValue = expression.value
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      expressionType: exprValue.type,
    }

    // Build payload structure for expression
    const expressionLabel = EXPRESSION_LABELS[exprValue.type] || EXPRESSION_LABELS.neutral_serious

    const payload: Record<string, unknown> = {
      subject: {
        expression: {
          type: exprValue.type,
          description: expressionLabel,
        },
      },
    }

    return {
      mustFollow,
      payload,
      metadata,
    }
  }

  validate(settings: import('@/types/photo-style').PhotoStyleSettings): string[] {
    const errors: string[] = []
    const expression = settings.expression

    if (!expression || !hasValue(expression)) {
      return errors
    }

    const exprValue = expression.value
    const validExpressions = [
      'genuine_smile', 'soft_smile', 'neutral_serious',
      'laugh_joy', 'contemplative', 'confident', 'sad'
    ]

    if (exprValue.type && !validExpressions.includes(exprValue.type)) {
      errors.push(`Unknown expression type: ${exprValue.type}`)
    }

    return errors
  }

  get priority(): number {
    return 45
  }
}

export const expressionElement = new ExpressionElement()
export default expressionElement

// Auto-register on import
autoRegisterElement(expressionElement)
