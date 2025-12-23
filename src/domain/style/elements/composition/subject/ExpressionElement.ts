/**
 * Expression Element
 *
 * Contributes facial expression rules to person generation.
 * Handles various expressions from genuine smile to contemplative to neutral.
 */

import { StyleElement, ElementContext, ElementContribution } from '../../base/StyleElement'

export class ExpressionElement extends StyleElement {
  readonly id = 'expression'
  readonly name = 'Expression'
  readonly description = 'Facial expression and emotional tone'

  // Expression only affects person generation
  isRelevantForPhase(context: ElementContext): boolean {
    const { phase, settings } = context

    // Skip if no expression configured
    if (!settings.expression) {
      return false
    }

    // Skip if user-choice
    if (settings.expression.type === 'user-choice') {
      return false
    }

    // Only contribute to person generation
    return phase === 'person-generation'
  }

  async contribute(context: ElementContext): Promise<ElementContribution> {
    const { settings } = context
    const expression = settings.expression!

    const instructions: string[] = []
    const mustFollow: string[] = []
    const metadata: Record<string, unknown> = {
      expressionType: expression.type,
    }

    // Build payload structure for expression
    const payload: Record<string, unknown> = {
      subject: {
        expression: {
          type: expression.type,
        },
      },
    }

    // Generate expression-specific instructions and payload details
    const expressionPayload = (payload.subject as Record<string, unknown>).expression as Record<string, unknown>

    switch (expression.type) {
      case 'genuine_smile':
        expressionPayload.description = 'Genuine smile showing teeth, natural and approachable'
        break

      case 'soft_smile':
        expressionPayload.description = 'Soft professional smile without teeth, subtle and polished'
        break

      case 'neutral_serious':
        expressionPayload.description = 'Neutral, relaxed expression with calm composure'
        break

      case 'laugh_joy':
        expressionPayload.description = 'Bright, joyful laughter with wide smile and energy'
        break

      case 'contemplative':
        expressionPayload.description = 'Thoughtful, engaged expression with intelligence and introspection'
        break

      case 'confident':
        expressionPayload.description = 'Confident, poised expression with self-assurance'
        break

      case 'sad':
        expressionPayload.description = 'Subtle contemplative expression with gentle emotion'
        break

      default:
        // Unknown expression - use neutral
        expressionPayload.description = 'Natural, relaxed expression'
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

    if (!expression) {
      return errors
    }

    // Validate expression type
    const validExpressions = [
      'genuine_smile',
      'soft_smile',
      'neutral_serious',
      'laugh_joy',
      'contemplative',
      'confident',
      'sad',
      'user-choice'
    ]

    if (expression.type && !validExpressions.includes(expression.type)) {
      errors.push(`Unknown expression type: ${expression.type}`)
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
