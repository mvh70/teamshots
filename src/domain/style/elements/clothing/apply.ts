import { generateWardrobePrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import { setPath } from '../../prompt-builders/context'

export function applyToPayload(context: PromptBuildContext): void {
  const wardrobeResult = generateWardrobePrompt({
    clothing: context.settings.clothing,
    clothingColors: context.settings.clothingColors,
    shotType: context.settings.shotType?.type
  })
  setPath(context.payload, 'subject.wardrobe', wardrobeResult.wardrobe)
}
