import { generateBackgroundPrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import { setPath } from '../../prompt-builders/context'

export function applyToPayload(context: PromptBuildContext): void {
  const background = context.settings.background
  if (background) {
    const bgPrompt = generateBackgroundPrompt(background)
    if (bgPrompt.location_type) {
      setPath(context.payload, 'scene.environment.location_type', bgPrompt.location_type)
    }
    if (bgPrompt.description) {
      setPath(context.payload, 'scene.environment.description', bgPrompt.description)
    }
    if (bgPrompt.color_palette) {
      setPath(context.payload, 'scene.environment.color_palette', bgPrompt.color_palette)
    }
    if (bgPrompt.branding) {
      setPath(context.payload, 'scene.environment.branding', bgPrompt.branding)
    }
  }
}
