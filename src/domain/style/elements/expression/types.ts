export interface ExpressionSettings {
  type:
    | 'genuine_smile'
    | 'soft_smile'
    | 'neutral_serious'
    | 'laugh_joy'
    | 'contemplative'
    | 'confident'
    | 'sad'
    | 'user-choice'
}

/**
 * Type alias for expression type values
 */
export type ExpressionType = ExpressionSettings['type']

