import type { ElementConfig } from '../registry'
import { deserialize } from './deserializer'
import type { ExpressionSettings, ExpressionType } from './types'
import { predefined, userChoice } from '../base/element-types'

/**
 * UI configuration for expression options
 * Defines the visual presentation and metadata for each expression type
 */
export interface ExpressionConfig {
  value: ExpressionType
  icon: string
  color: string
}

/**
 * All available expression IDs
 */
export const ALL_EXPRESSION_IDS: ExpressionType[] = [
  'genuine_smile',
  'soft_smile',
  'neutral_serious',
  'laugh_joy',
  'contemplative',
  'confident',
  'sad'
]

/**
 * UI configuration for each expression type
 * Icons and colors only - labels and descriptions come from i18n
 */
export const EXPRESSION_CONFIGS: ExpressionConfig[] = [
  {
    value: 'genuine_smile',
    icon: '😁',
    color: 'from-yellow-400 to-orange-400'
  },
  {
    value: 'soft_smile',
    icon: '🙂',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    value: 'neutral_serious',
    icon: '😐',
    color: 'from-gray-600 to-gray-800'
  },
  {
    value: 'laugh_joy',
    icon: '😆',
    color: 'from-pink-400 to-rose-500'
  },
  {
    value: 'contemplative',
    icon: '🤔',
    color: 'from-purple-500 to-violet-600'
  },
  {
    value: 'confident',
    icon: '😎',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    value: 'sad',
    icon: '😢',
    color: 'from-gray-500 to-gray-600'
  }
]

/**
 * Resolve expression config by value
 */
export function resolveExpression(value: string): ExpressionConfig | undefined {
  return EXPRESSION_CONFIGS.find(e => e.value === value)
}

/**
 * Element registry config for expression
 */
export const expressionElementConfig: ElementConfig<ExpressionSettings> = {
  getDefaultPredefined: () => predefined({ type: 'neutral_serious' }),
  getDefaultUserChoice: () => userChoice(),
  deserialize
}
