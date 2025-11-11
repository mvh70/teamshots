export interface ExpressionConfig {
  value: string
  label: string
  description: string
}

export const EXPRESSION_CONFIGS: ExpressionConfig[] = [
  { value: 'friendly', label: 'Genuine smile (teeth) *', description: 'Approachable, friendly' },
  { value: 'professional', label: 'Soft smile (no teeth)', description: 'Professional, subtle' },
  { value: 'serious', label: 'Neutral / serious', description: 'Executive, dramatic' },
  { value: 'happy', label: 'Laugh / joy', description: 'Lifestyle, authentic' },
  { value: 'thoughtful', label: 'Contemplative', description: 'Editorial, artistic' }
]

export function resolveExpression(value: string): ExpressionConfig | undefined {
  return EXPRESSION_CONFIGS.find(e => e.value === value)
}

