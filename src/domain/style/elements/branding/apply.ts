import { generateBrandingPrompt } from './prompt'
import type { PromptBuildContext } from '../../prompt-builders/context-types'
import type { KnownClothingStyle } from '../clothing/config'
import { setPath } from '../../prompt-builders/context'

export function applyToPayload(context: PromptBuildContext): void {
  // Read dependencies from payload
  const subject = context.payload.subject as Record<string, unknown> | undefined
  const wardrobe = subject?.wardrobe as Record<string, unknown> | undefined

  const styleKey = wardrobe?.style_key as KnownClothingStyle
  const detailKey = wardrobe?.detail_key as string

  const result = generateBrandingPrompt({
    branding: context.settings.branding,
    styleKey,
    detailKey
  })

  const position = result.branding.position as string | undefined

  // Extract rules from result and add to context must follow rules section
  // IMPORTANT: Only add rules for CLOTHING branding (Step 1: person generation)
  // Background/elements branding rules are handled in Step 3 (refinement)
  if (result.rules && Array.isArray(result.rules)) {
    if (position === 'clothing' || !position) {
      // Clothing branding: rules apply to person generation (Step 1)
      context.mustFollowRules.push(...result.rules)
    }
    // For background/elements: rules are NOT added here
    // They will be applied during Step 3 refinement when compositing the background
  }

  // Add branding info to payload (without rules)
  // Position determines where branding is placed in the JSON structure:
  // - clothing: part of the subject (subject.branding)
  // - background/elements: part of the scene (scene.branding)
  if (position === 'background' || position === 'elements') {
    setPath(context.payload, 'scene.branding', result.branding)
  } else {
    // Default to subject.branding for clothing or when position is not specified
    setPath(context.payload, 'subject.branding', result.branding)
  }
}
