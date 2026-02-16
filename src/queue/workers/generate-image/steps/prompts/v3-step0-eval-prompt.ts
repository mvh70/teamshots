import {
  getStep0BrandingEvalPrompt,
  type Step0BrandingEvalScenario,
} from '@/domain/style/elements/branding/prompt'

export function buildStep0EvalPrompt(scenario: Step0BrandingEvalScenario): string {
  return getStep0BrandingEvalPrompt(scenario)
}
