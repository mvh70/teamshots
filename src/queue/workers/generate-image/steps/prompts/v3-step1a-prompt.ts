import { getStep1aShotTypeFramingConstraint } from '@/domain/style/elements/shot-type/prompt'

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

export function projectStep1aPromptPayload(
  canonicalPrompt: Record<string, unknown>
): Record<string, unknown> {
  const projected: Record<string, unknown> = {}

  const subject = asObject(canonicalPrompt.subject)
  if (subject) projected.subject = subject

  const framing = asObject(canonicalPrompt.framing)
  if (framing) projected.framing = framing

  const wardrobe = asObject(canonicalPrompt.wardrobe)
  if (wardrobe) projected.wardrobe = wardrobe

  // Step 1a is deliberately background-agnostic: regardless of user background
  // settings, person generation happens on a fixed neutral grey backdrop.
  projected.scene = {
    background: {
      type: 'solid',
      color: '#808080',
      description: 'Solid flat neutral grey background (#808080)',
    },
  }

  projected.technical_details = {
    resolution: '8k',
    texture_detail: 'visible fabric texture, lace detail, skin texture',
    dynamic_range: 'high dynamic range',
  }

  return projected
}

export function getStep1aRoleTaskIntro(shotTypeIntroContext: string): string {
  return `You are a world-class professional photographer creating ${shotTypeIntroContext} from the attached selfies.`
}

export function getStep1aHardConstraints(params: {
  bodyBoundaryInstruction?: string
  shotDescription: string
  hasClothingReference: boolean
}): string[] {
  const hardConstraints = [
    '**HARD CONSTRAINTS (Non-Negotiable):**',
    getStep1aShotTypeFramingConstraint({
      bodyBoundaryInstruction: params.bodyBoundaryInstruction,
      shotDescription: params.shotDescription,
    }),
    '2. **Background:** Solid neutral grey (#808080) only. No gradients, props, environment, or text.',
  ]

  if (params.hasClothingReference) {
    hardConstraints.push(
      '3. **Clothing:** Use the clothing reference as PRIMARY source for all garment styling.'
    )
  }

  return hardConstraints
}

export function getStep1aTechnicalRequirements(params: {
  expectedWidth: number
  expectedHeight: number
  aspectRatioId: string
  allowAuthorizedLogosInStep1a: boolean
}): string[] {
  return [
    `- Output: ${params.expectedWidth}x${params.expectedHeight}px (${params.aspectRatioId}). Fill canvas edge-to-edge.`,
    '- Phone-camera realism with subtle sensor grain and slight edge softness.',
    '- Keep lighting neutral and even on the subject. Do not apply scene-specific dramatic or directional lighting in this step.',
    '- Negatives: avoid AI glow, plastic skin, skincare-ad look, cinematic lighting, dramatic directional lighting, visible studio-light look, pastel or faded colors, cartoon/3D style' +
      (params.allowAuthorizedLogosInStep1a ? ', unauthorized logos or text.' : ', logos or text.'),
  ]
}

export function getStep1aCreativeLatitudeBase(): string[] {
  return [
    '- Preserve gentle depth while keeping subject lighting neutral and even',
    '- Subtle color grading to enhance professional appearance',
  ]
}
