export function buildStep1aEvalPrompt(params: {
  authorizedAccessories: string[]
  promptContext: Record<string, unknown>
  hasFaceReference: boolean
  hasBodyReference: boolean
  hasGarmentReference: boolean
  subjectGender?: string
}): string {
  const isFemaleSubject = (params.subjectGender || '').toLowerCase() === 'female'

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
    '6. no_visible_reference_labels',
    '7. wardrobe_and_colors_match (check that visible clothing style/layers and colors match authorized wardrobe guidance; use UNCERTAIN if framing does not reveal enough clothing to verify)',
    params.authorizedAccessories.length > 0
      ? `   - CLOTHING-LEVEL ACCESSORIES AUTHORIZED: ${params.authorizedAccessories.join(', ')}`
      : '   - No inherent accessories specified for this clothing style',
    params.hasFaceReference
      ? '   - Accessories visible in FACE REFERENCE are authorized for this criterion.'
      : null,
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    '{',
    '  "is_fully_generated": "YES",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_add_ons": "YES",',
    '  "no_unauthorized_accessories": "YES",',
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
