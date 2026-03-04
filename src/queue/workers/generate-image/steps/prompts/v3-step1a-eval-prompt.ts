export function buildStep1aEvalPrompt(params: {
  authorizedAccessories: string[]
  configuredAccessoryActions: Array<{ accessory: string; action: 'keep' | 'remove' }>
  promptContext: Record<string, unknown>
  hasFaceReference: boolean
  hasBodyReference: boolean
  hasGarmentReference: boolean
  subjectGender?: string
  mustFollowRules?: string[]
}): string {
  const shotType =
    ((params.promptContext.framing as { shot_type?: string } | undefined)?.shot_type as
      | string
      | undefined) || ''
  const shotRevealsWaist = ['medium-shot', 'three-quarter', 'full-length', 'wide-shot'].includes(
    shotType
  )
  const isFemaleSubject = (params.subjectGender || '').toLowerCase() === 'female'
  const dedupedMustFollowRules = Array.from(
    new Map(
      (params.mustFollowRules || [])
        .map((rule) => rule?.trim())
        .filter((rule): rule is string => Boolean(rule))
        .map((rule) => [rule.toLowerCase(), rule])
    ).values()
  )

  const instructions = [
    'You are evaluating a generated portrait variation. Answer each question with ONLY:',
    '- YES (criterion fully met)',
    '- NO (criterion failed)',
    '- UNCERTAIN (cannot determine)',
    '',
    'CRITICAL: The generated image must be FULLY AI-GENERATED. If you see ANY portions of the reference selfies literally embedded (cut/pasted/composited) into the output, answer "NO" to is_fully_generated.',
    params.hasFaceReference
      ? 'CRITICAL REFERENCE SCOPING: FACE REFERENCE is the source of truth for facial identity and face/head accessories (e.g., glasses, earrings).'
      : 'CRITICAL REFERENCE SCOPING: Use available selfie references as the source of truth for facial identity and face/head accessories.',
    params.hasBodyReference
      ? `CRITICAL REFERENCE SCOPING: BODY REFERENCE is ONLY for body proportions/form${
          isFemaleSubject ? ' (including natural breast/chest shape)' : ''
        }. Do NOT use BODY REFERENCE to reject face/head accessories.`
      : null,
    params.hasFaceReference && params.hasBodyReference
      ? 'If FACE and BODY references conflict on accessories, follow FACE REFERENCE.'
      : null,
    'CRITICAL ACCESSORY ACTIONS: Enforce explicit accessory actions from subject.beautification.accessories.',
    params.configuredAccessoryActions.length > 0
      ? 'For each configured accessory action: "keep" means preserve it as shown in references (when visible); "remove" means it must be absent in the candidate output.'
      : 'No explicit keep/remove accessory actions are configured. For accessory_action_compliance, answer YES unless there is clear violation of prompt context.',
    params.hasGarmentReference
      ? 'CRITICAL WARDROBE SCOPING: GARMENT COLLAGE REFERENCE is the source of truth for wardrobe structure and clothing colors.'
      : 'CRITICAL WARDROBE SCOPING: Use subject.wardrobe in the prompt JSON as the source of truth for wardrobe structure and clothing colors.',
    '',
    'Questions:',
    '',
    '1. is_fully_generated',
    '2. identity_preserved',
    '3. proportions_realistic',
    '4. no_unauthorized_add_ons',
    '5. no_unauthorized_accessories (evaluate from FACE/SELFIE references; do NOT fail this based on BODY reference accessory absence)',
    '6. accessory_action_compliance (for explicit keep/remove actions in subject.beautification.accessories)',
    '7. no_visible_reference_labels',
    '8. wardrobe_and_colors_match (check that the OVERALL garment type, number of layers, and approximate colors match authorized wardrobe guidance. Focus on: correct garment category (suit vs shirt vs dress), correct layer count, and color family. Do NOT reject for minor styling variations like button fastened vs unfastened, exact collar shape, slight drape differences, or minor fit details that AI generation cannot reliably control. Use UNCERTAIN if framing does not reveal enough clothing to verify)',
    params.authorizedAccessories.length > 0
      ? `   - CLOTHING-LEVEL ACCESSORIES AUTHORIZED: ${params.authorizedAccessories.join(', ')}`
      : '   - No inherent accessories specified for this clothing style',
    params.authorizedAccessories.map((item) => item.toLowerCase()).includes('belt') &&
    shotRevealsWaist
      ? '   - Belt is REQUIRED for this waist-revealing shot. The waistband area must show a visible belt (strap and buckle), and belt color must be clearly distinct from trouser color.'
      : params.authorizedAccessories.map((item) => item.toLowerCase()).includes('belt')
        ? '   - If belt is visible, it must be clearly distinct from trouser color.'
      : null,
    params.hasFaceReference
      ? '   - Accessories visible in FACE REFERENCE are authorized for this criterion.'
      : null,
    ...(params.configuredAccessoryActions.length > 0
      ? [
          '   - EXPLICIT ACCESSORY ACTIONS TO ENFORCE:',
          ...params.configuredAccessoryActions.map(
            ({ accessory, action }) => `     - ${accessory}: ${action.toUpperCase()}`
          ),
        ]
      : []),
    ...(dedupedMustFollowRules.length > 0
      ? [
          '',
          'AUTHORIZED MODIFICATIONS (do NOT penalize these):',
          ...dedupedMustFollowRules.map((rule) => `- ${rule}`),
        ]
      : []),
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    '{',
    '  "is_fully_generated": "YES",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_add_ons": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "accessory_action_compliance": "YES",',
    '  "no_visible_reference_labels": "YES",',
    '  "wardrobe_and_colors_match": "YES",',
    '  "explanations": {',
    '    "identity_preserved": "Face matches reference"',
    '  }',
    '}',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n')

  const safePromptContext = JSON.stringify(params.promptContext, null, 2)

  return `${instructions}\n\nIMPORTANT CONTEXT FOR EVALUATION:\n- Step 1a generates ONLY the person on a grey background.\n- Ignore background instructions for this evaluation.\n- Use the prompt below for shot type and subject context only.\n\n---BEGIN_GENERATION_PROMPT_JSON---\n${safePromptContext}\n---END_GENERATION_PROMPT_JSON---\n\nCandidate image variation`
}
