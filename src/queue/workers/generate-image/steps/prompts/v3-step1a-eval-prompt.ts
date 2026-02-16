export const STEP1A_EVAL_DEFAULT_EXPLANATIONS = {
  custom_background_matches:
    'Step 1a generates only the person on grey background. Custom backgrounds are handled later.',
  branding_logo_matches: 'Step 0 evaluates logo fidelity before person generation.',
  branding_positioned_correctly: 'Step 0 evaluates logo placement before person generation.',
  branding_scene_aligned: 'Step 0 evaluates logo scene alignment/integration before person generation.',
  clothing_logo_no_overflow: 'Step 0 evaluates logo overflow before person generation.',
} as const

export function buildStep1aEvalPrompt(params: {
  authorizedAccessories: string[]
  promptContext: Record<string, unknown>
  hasFaceReference: boolean
  hasBodyReference: boolean
  subjectGender?: string
}): string {
  const isFemaleSubject = (params.subjectGender || '').toLowerCase() === 'female'

  const instructions = [
    'You are evaluating a generated portrait variation. Answer each question with ONLY:',
    '- YES (criterion fully met)',
    '- NO (criterion failed)',
    '- UNCERTAIN (cannot determine)',
    '- N/A (not applicable)',
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
    '',
    'Questions:',
    '',
    '1. is_fully_generated',
    '2. composition_matches_shot: N/A (temporarily disabled)',
    '3. identity_preserved',
    '4. proportions_realistic',
    '5. no_unauthorized_add_ons',
    '6. no_unauthorized_accessories (evaluate from FACE/SELFIE references; do NOT fail this based on BODY reference accessory absence)',
    '7. no_visible_reference_labels',
    '8. custom_background_matches: N/A (no custom background required)',
    params.authorizedAccessories.length > 0
      ? `   - CLOTHING-LEVEL ACCESSORIES AUTHORIZED: ${params.authorizedAccessories.join(', ')}`
      : '   - No inherent accessories specified for this clothing style',
    params.hasFaceReference
      ? '   - Accessories visible in FACE REFERENCE are authorized for this criterion.'
      : null,
    '9. branding_logo_matches: N/A (branding evaluated in Step 0)',
    '10. branding_positioned_correctly: N/A (branding evaluated in Step 0)',
    '11. branding_scene_aligned: N/A (branding evaluated in Step 0)',
    '12. clothing_logo_no_overflow: N/A (branding evaluated in Step 0)',
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    '{',
    '  "is_fully_generated": "YES",',
    '  "composition_matches_shot": "N/A",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_add_ons": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "no_visible_reference_labels": "YES",',
    '  "custom_background_matches": "N/A",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "clothing_logo_no_overflow": "N/A",',
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
