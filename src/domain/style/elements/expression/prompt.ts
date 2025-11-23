import { getExpressionLabel, ExpressionType } from './config'

const POSE_DESCRIPTIONS: Record<ExpressionType, string> = {
  genuine_smile: 'Genuine smile showing teeth - approachable, friendly.',
  soft_smile: 'Soft professional smile without showing teeth - professional, subtle.',
  neutral_serious: 'Neutral/serious expression - executive, dramatic.',
  laugh_joy: 'Joyful laugh with bright smile - lifestyle, authentic.',
  contemplative: 'Thoughtful engaged expression - editorial, artistic.',
  confident: 'Confident poised look - professional, subtle.',
  sad: 'Subtle contemplative expression - editorial, artistic.',
  'user-choice': 'Natural expression facing camera.'
}

export interface ExpressionPromptResult {
  expression: string
  poseDescription: string
}

export const generateExpressionPrompt = (expression?: { type?: ExpressionType } | null): ExpressionPromptResult => {
  const expressionType = expression?.type || 'soft_smile'
  return {
    expression: getExpressionLabel(expressionType),
    poseDescription: POSE_DESCRIPTIONS[expressionType] || POSE_DESCRIPTIONS.soft_smile
  }
}

