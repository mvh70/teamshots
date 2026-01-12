import type { ElementSetting } from '../base/element-types'

/**
 * Available expression types (without 'user-choice')
 */
export type ExpressionType =
  | 'genuine_smile'
  | 'soft_smile'
  | 'neutral_serious'
  | 'laugh_joy'
  | 'contemplative'
  | 'confident'
  | 'sad'

/**
 * Expression value - the actual expression configuration
 */
export interface ExpressionValue {
  type: ExpressionType
}

/**
 * Expression settings with mode wrapper
 */
export type ExpressionSettings = ElementSetting<ExpressionValue>

/**
 * Legacy format for migration support
 * @deprecated Use ExpressionSettings instead
 */
export interface LegacyExpressionSettings {
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
