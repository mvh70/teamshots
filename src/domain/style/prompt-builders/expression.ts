import { getExpressionLabel } from '../packages/pose-presets'

type ExpressionType = 'professional' | 'friendly' | 'serious' | 'confident' | 'happy' | 'sad' | 'neutral' | 'thoughtful' | 'user-choice'

const POSE_DESCRIPTIONS: Record<ExpressionType, string> = {
  professional: 'Professional posture facing camera with relaxed confidence.',
  friendly: 'Warm and approachable posture facing camera.',
  serious: 'Serious and focused posture facing camera.',
  confident: 'Confident and poised posture facing camera.',
  happy: 'Joyful and engaging posture facing camera.',
  sad: 'Contemplative and introspective posture facing camera.',
  neutral: 'Balanced and composed posture facing camera.',
  thoughtful: 'Thoughtful and engaged posture facing camera.',
  'user-choice': 'Natural posture facing camera.'
}

export interface ExpressionPromptResult {
  expression: string
  poseDescription: string
}

export const generateExpressionPrompt = (expression?: { type?: ExpressionType } | null): ExpressionPromptResult => {
  const expressionType = expression?.type || 'professional'
  return {
    expression: getExpressionLabel(expressionType),
    poseDescription: POSE_DESCRIPTIONS[expressionType] || POSE_DESCRIPTIONS.professional
  }
}

