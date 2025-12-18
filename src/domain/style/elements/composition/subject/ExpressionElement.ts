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

    // Generate expression-specific instructions
    switch (expression.type) {
      case 'genuine_smile':
        instructions.push(
          'The person should have a genuine smile showing teeth',
          'Expression should appear natural, approachable, and friendly',
          'Eyes should show warmth and engagement (smile with eyes)'
        )
        mustFollow.push(
          'Smile must show teeth clearly',
          'Expression must appear natural and authentic, not forced',
          'Eyes must reflect the smile (crows feet, lifted cheeks)'
        )
        break

      case 'soft_smile':
        instructions.push(
          'The person should have a soft professional smile without showing teeth',
          'Expression should be subtle, professional, and polished',
          'Mouth should be gently curved upward'
        )
        mustFollow.push(
          'Smile must be closed-mouth (no teeth showing)',
          'Expression must appear professional and controlled',
          'Face should show subtle warmth without being too casual'
        )
        break

      case 'neutral_serious':
        instructions.push(
          'The person should have a neutral, relaxed expression',
          'Face should be calm and composed',
          'Expression should convey professionalism and confidence'
        )
        mustFollow.push(
          'Face must be neutral without smiling',
          'Expression must appear natural and relaxed, not tense',
          'Eyes should be engaged and focused'
        )
        break

      case 'laugh_joy':
        instructions.push(
          'The person should be laughing with a bright, joyful smile',
          'Expression should appear authentic and full of life',
          'Face should show genuine happiness and energy'
        )
        mustFollow.push(
          'Expression must show clear joy and laughter',
          'Smile must be wide and teeth visible',
          'Face must appear animated and energetic'
        )
        break

      case 'contemplative':
        instructions.push(
          'The person should have a thoughtful, engaged expression',
          'Face should show intelligence and introspection',
          'Expression should be subtle and artistic'
        )
        mustFollow.push(
          'Expression must appear thoughtful and engaged',
          'Face should show subtle emotion and depth',
          'Eyes should appear focused and contemplative'
        )
        break

      case 'confident':
        instructions.push(
          'The person should have a confident, poised expression',
          'Face should show self-assurance and professionalism',
          'Expression should be strong but approachable'
        )
        mustFollow.push(
          'Expression must convey confidence and poise',
          'Face should appear professional and assured',
          'Eyes should show focus and self-assurance'
        )
        break

      case 'sad':
        instructions.push(
          'The person should have a subtle contemplative expression',
          'Face should show gentle emotion',
          'Expression should be artistic and editorial'
        )
        mustFollow.push(
          'Expression must show subtle sadness or contemplation',
          'Face should appear natural, not overly dramatic',
          'Eyes should reflect the emotional tone'
        )
        break

      default:
        // Unknown expression - use neutral
        instructions.push('The person should have a natural, relaxed expression')
        mustFollow.push('Expression must appear natural and authentic')
    }

    // Add general expression rules
    mustFollow.push(
      'Expression must match the person\'s facial structure naturally',
      'Face must not appear distorted or unnatural',
      'Expression should be appropriate for a professional photograph'
    )

    return {
      instructions,
      mustFollow,
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
