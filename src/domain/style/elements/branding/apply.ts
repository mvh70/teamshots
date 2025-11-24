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

  // Extract rules from result and add to context rules section
  if (result.rules && Array.isArray(result.rules)) {
    context.rules.push(...result.rules)
  }

  // Add branding info to payload (without rules)
  setPath(context.payload, 'subject.branding', result.branding)
}
