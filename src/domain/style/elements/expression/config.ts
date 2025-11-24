import type { ExpressionSettings } from '@/types/photo-style'

export type ExpressionType = ExpressionSettings['type']

export interface ExpressionConfig {
  value: ExpressionType
  label: string
  description: string
  icon: string
  color: string
}

export const ALL_EXPRESSION_IDS: ExpressionType[] = [
  'genuine_smile',
  'soft_smile',
  'neutral_serious',
  'laugh_joy',
  'contemplative',
  'confident',
  'sad'
]

export const EXPRESSION_CONFIGS: ExpressionConfig[] = [
  {
    value: 'genuine_smile',
    label: 'Genuine smile (teeth) *',
    description: 'Approachable, friendly',
    icon: '😁',
    color: 'from-yellow-400 to-orange-400'
  },
  {
    value: 'soft_smile',
    label: 'Soft smile (no teeth)',
    description: 'Professional, subtle',
    icon: '🙂',
    color: 'from-blue-500 to-indigo-500'
  },
  {
    value: 'neutral_serious',
    label: 'Neutral / serious',
    description: 'Executive, dramatic',
    icon: '😐',
    color: 'from-gray-600 to-gray-800'
  },
  {
    value: 'laugh_joy',
    label: 'Laugh / joy',
    description: 'Lifestyle, authentic',
    icon: '😆',
    color: 'from-pink-400 to-rose-500'
  },
  {
    value: 'contemplative',
    label: 'Contemplative',
    description: 'Editorial, artistic',
    icon: '🤔',
    color: 'from-purple-500 to-violet-600'
  },
  {
    value: 'confident',
    label: 'Confident',
    description: 'Confident, poised',
    icon: '😎',
    color: 'from-blue-600 to-indigo-700'
  },
  {
    value: 'sad',
    label: 'Sad',
    description: 'Sad, contemplative',
    icon: '😢',
    color: 'from-gray-500 to-gray-600'
  }
]

export const EXPRESSION_LABELS: Record<NonNullable<ExpressionType>, string> = {
  genuine_smile: 'genuine smile showing teeth',
  soft_smile: 'soft professional smile without showing teeth',
  neutral_serious: 'neutral relaxed expression',
  laugh_joy: 'joyful laugh with bright smile',
  contemplative: 'thoughtful engaged expression',
  confident: 'confident poised look',
  sad: 'subtle contemplative expression',
  'user-choice': 'use photographer-selected expression'
}

export function resolveExpression(value: string): ExpressionConfig | undefined {
  return EXPRESSION_CONFIGS.find(e => e.value === value)
}

export function getExpressionLabel(type?: ExpressionType | null): string {
  if (!type) return EXPRESSION_LABELS.neutral_serious
  const expressionType = type as NonNullable<ExpressionType>
  return EXPRESSION_LABELS[expressionType] ?? EXPRESSION_LABELS.neutral_serious
}
