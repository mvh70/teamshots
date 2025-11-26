import type { PromptBuildContext } from '../../prompt-builders/context-types'

export function applyToPayload(context: PromptBuildContext): void {
  // Add subject identity rules (must follow)
  context.mustFollowRules.push(
    'Retain the identity of the person in the selfies as much as possible, do not beautify the resulting image, it should resemble as much as possible the selfies in the composite. Retain hair detail, facial features like wrinkles, freckles, moles, etc., and glasses',
    'Stay as close as possible to the original selfies. Do not invent details unless indicated specifically. If the selfies do not show glasses, do not add glasses. Keep the hairstyle as much as possible as in the selfies.',
    'Pay special attention to size of the head compared to the rest of the body - maintain realistic head-to-body proportions'
  )
  
  // Subject payload is already set by createBasePayload
}

