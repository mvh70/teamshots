import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { getVertexGenerativeModel } from '../gemini'
import { AI_CONFIG } from '../config'
import sharp from 'sharp'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import type { ImageEvaluationResult, StructuredEvaluation } from '../evaluator'
import type { Content, GenerateContentResult, Part } from '@google-cloud/vertexai'
import type { ReferenceImage } from '../utils/reference-builder'
import type { CostTrackingHandler } from '../workflow-v3'

export interface V3Step1aEvalInput {
  imageBuffer: Buffer
  imageBase64: string
  selfieReferences: ReferenceImage[]
  selfieComposite?: BaseReferenceImage
  expectedWidth: number
  expectedHeight: number
  aspectRatioConfig: { id: string; width: number; height: number }
  generationPrompt: string // JSON prompt - contains framing.shot_type
  clothingLogoReference?: BaseReferenceImage // Logo on clothing (if branding.position === 'clothing')
  garmentCollageReference?: BaseReferenceImage // Garment collage from custom clothing (authorizes accessories)
  // Note: No backgroundBuffer - Step 1a generates on white background, actual background comes in Step 2
  generationId?: string // For cost tracking
  personId?: string // For cost tracking
  teamId?: string // For cost tracking
  intermediateS3Key?: string // S3 key of the image being evaluated
  onCostTracking?: CostTrackingHandler // For cost tracking
}

export interface V3Step1aEvalOutput {
  evaluation: ImageEvaluationResult
}

const DIMENSION_TOLERANCE_PX = 50 // Generous tolerance for model variations
const ASPECT_RATIO_TOLERANCE = 0.05 // 5% tolerance

/**
 * V3 Step 1a Eval: Evaluate person generation
 * Checks if the generated person (on white background) meets quality requirements
 * Focus: face accuracy, pose, clothing (including clothing branding if applicable), shot type
 * NOTE: Skips background validation - grey background is guidance, not strict requirement
 */
export async function executeV3Step1aEval(
  input: V3Step1aEvalInput
): Promise<V3Step1aEvalOutput> {
  const {
    imageBuffer,
    imageBase64,
    selfieReferences,
    selfieComposite,
    expectedWidth,
    expectedHeight,
    generationPrompt,
    clothingLogoReference,
    garmentCollageReference
  } = input

  Logger.debug('V3 Step 1a Eval: Evaluating person generation (grey background)', {
    hasClothingLogo: !!clothingLogoReference,
    hasSelfieComposite: !!selfieComposite,
    hasGarmentCollage: !!garmentCollageReference
  })

  // Parse prompt to extract shot type and wardrobe info (no longer passed as separate arg)
  const promptObj = JSON.parse(generationPrompt)
  const shotType = promptObj.framing?.shot_type || 'medium-shot'
  const shotLabel = shotType.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
  const shotDescription = promptObj.framing?.description || promptObj.framing?.crop_points || `${shotLabel} framing`

  // Extract inherent accessories from wardrobe - these are authorized by the clothing style
  const wardrobeObj = promptObj.wardrobe as { inherent_accessories?: string[], accessories?: string[] } | undefined
  const inherentAccessories = wardrobeObj?.inherent_accessories || []
  const userAccessories = wardrobeObj?.accessories || []
  const authorizedAccessories = [...new Set([...inherentAccessories, ...userAccessories])]

  const metadata = await sharp(imageBuffer).metadata()
  const actualWidth = metadata.width ?? null
  const actualHeight = metadata.height ?? null

  // 1. Evaluation Logic (Inlined from evaluator.ts)
  const evalModel = Env.string('GEMINI_EVAL_MODEL', '')
  const imageModel = Env.string('GEMINI_IMAGE_MODEL', '')
  const modelName = evalModel || imageModel || 'gemini-2.5-flash'
  
  const model = await getVertexGenerativeModel(modelName)

  const expectedRatio = expectedWidth / expectedHeight
  const actualRatio =
    actualWidth && actualHeight && actualHeight !== 0 ? actualWidth / actualHeight : null

  const dimensionMismatch =
    actualWidth === null ||
    actualHeight === null ||
    Math.abs(actualWidth - expectedWidth) > DIMENSION_TOLERANCE_PX ||
    Math.abs(actualHeight - expectedHeight) > DIMENSION_TOLERANCE_PX

  const aspectMismatch =
    actualRatio === null ? true : Math.abs(actualRatio - expectedRatio) > ASPECT_RATIO_TOLERANCE

  const matchingReference = selfieReferences.find((selfie) => selfie.base64 === imageBase64)
  const selfieDuplicate = Boolean(matchingReference)

  // 2. Construct Prompt
  const baseInstructions = [
    `You are evaluating a generated portrait variation. Answer each question with ONLY:`,
    '- YES (criterion fully met)',
    '- NO (criterion failed)',
    '- UNCERTAIN (cannot determine)',
    '- N/A (not applicable)',
    '',
    'CRITICAL: The generated image must be FULLY AI-GENERATED. If you see ANY portions of the reference selfies literally embedded (cut/pasted/composited) into the output, answer "NO" to is_fully_generated.',
    '',
    'Questions:',
    '',
    '1. is_fully_generated',
    '   - Is the ENTIRE image AI-generated from scratch?',
    '   - Are there NO visible portions of the reference selfies literally embedded?',
    '   - Look for: cut-and-paste artifacts, mismatched lighting on body parts,',
    '     sharp boundaries between face/body, original photo backgrounds, unnatural compositing',
    '',
    '2. composition_matches_shot: N/A (temporarily disabled)',
    '',
    '3. identity_preserved',
    '   - Does the face clearly resemble the reference selfies?',
    '   - Is facial identity consistent and recognizable?',
    '',
    '4. proportions_realistic',
    '   - Is head size proportional and realistic compared to the rest of the body?',
    '   - Does the head appear neither too large (like a caricature) nor too small relative to torso, limbs, and overall body?',
    '   - Are there NO exaggerated or shrunken anatomical features?',
    '   - Pay special attention to head-to-body ratio - it should match realistic human proportions',
    '',
    '5. no_unauthorized_add-ons',
    '   - Are there NO unauthorized add-ons, like tie, unless specified in the accessories list',
    '',
    '6. no_unauthorized_accessories',
    '   - CRITICAL: Compare the reference selfies AND garment collage (if provided) CAREFULLY to the generated image',
    '   - Are there NO unauthorized accessories that are ABSENT from BOTH the reference selfies AND the garment collage?',
    '   - Check specifically for:',
    '     * Jewelry: earrings, necklaces, bracelets, rings, watches, chains',
    '     * Piercings: ear piercings, nose piercings, facial piercings',
    '     * Glasses: eyeglasses, sunglasses, reading glasses',
    '     * Headwear: hats, caps, headbands, hair accessories',
    '     * Tattoos: any visible tattoos or body art',
    '     * Clothing accessories: pocket square, tie (ONLY check these - belt and cufflinks may be inherent to clothing style)',
    '   - If a garment collage reference is provided, accessories visible in the collage ARE AUTHORIZED',
    authorizedAccessories.length > 0
      ? `   - INHERENT ACCESSORIES: The following are AUTHORIZED by the clothing style and should NOT be rejected: ${authorizedAccessories.join(', ')}`
      : '   - No inherent accessories specified for this clothing style',
    '   - Answer YES if all accessories appear in EITHER the selfies OR the garment collage OR the inherent accessories list',
    '   - Answer NO (REJECT) only if an accessory appears in the generated image but is NOT in the selfies AND NOT in the garment collage AND NOT in the inherent accessories list',
    '   - Answer NO (REJECT) if the person has earrings in the generated image but NO earrings in the selfies AND NO earrings in the collage',
    '   - Answer NO (REJECT) if the person has glasses in the generated image but NO glasses in the selfies AND NO glasses in the collage',
    '   - Answer YES if no accessories are present in either the generated image or the selfies',
    '',
    '7. no_visible_reference_labels',
    '   - Are there NO visible labels, text overlays, or bordered text boxes containing words like:',
    '     SUBJECT, SELFIE, LOGO, FORMAT, REFERENCE, ADDITIONAL, or similar labeling patterns?',
    '   - Look specifically for: white/light boxes with borders containing text, labels with patterns like',
    '     "SUBJECT1-SELFIE#", "FORMAT #:#", or any text that appears to be from reference materials',
    '   - Legitimate scene text (signs, badges, documents) is acceptable if contextually appropriate',
    '   - Answer NO if you see ANY bordered labels with our reference keywords'
  ]

  // Skip background validation for Step 1a (grey BG)
  baseInstructions.push(
    '',
    '8. custom_background_matches: N/A (no custom background required)',
    '   - IMPORTANT: Step 1a generates ONLY the person on a grey background.',
    '   - Custom backgrounds and background logos are handled in Step 1b/Step 3.',
    '   - If the generation prompt mentions backgrounds or background/element logos, IGNORE those instructions for this evaluation.',
    '   - This step only evaluates the person generation quality.'
  )

  if (clothingLogoReference) {
    baseInstructions.push(
      '',
      '9. branding_logo_matches',
      '   - Does the logo in the generated image EXACTLY match the provided brand asset?',
      '   - Are colors, proportions, and design elements preserved with NO distortion or modifications?',
      '   - Is the logo the SAME SIZE (dimensions/aspect ratio) as the reference, not enlarged or shrunk?',
      '   - Are there NO additional elements added to the logo (no boxes, borders, labels, text overlays, backgrounds)?',
      '   - Look specifically for: reference label artifacts (e.g., "LOGO", "BRAND"), white/colored boxes around the logo, or any UI elements',
      '   - The logo should appear clean and isolated, exactly as provided in the reference',
      '',
      '10. branding_positioned_correctly',
      '   - Check the generation prompt for the EXACT placement instruction (e.g., "left chest", "center chest", "sleeve")',
      '   - Is the logo placed in EXACTLY the location specified in the prompt?',
      '   - Does it appear exactly ONCE (not duplicated, not missing)?',
      '   - Is the positioning accurate (not shifted, not rotated incorrectly, not placed on wrong body part)?',
      '',
      '11. branding_scene_aligned',
      '   - Is the logo integrated naturally into the scene without looking pasted or composited?',
      '   - Does lighting, perspective, and scale match the environment realistically?',
      '   - Does the logo follow the contours of the clothing/surface it\'s placed on?',
      '',
      '12. clothing_logo_no_overflow (CRITICAL CHECK FOR CLOTHING LOGOS)',
      '   - **STRICT REJECTION CRITERION**: The logo MUST exist ONLY on the BASE LAYER and must NOT spill over onto outer garments',
      '   - **IMPORTANT**: It is PERFECTLY ACCEPTABLE and EXPECTED for the logo to be PARTIALLY VISIBLE - this is realistic and desired',
      '   - **WHAT TO CHECK**:',
      '     1. Identify if outer layers are present: jackets, blazers, coats, cardigans, open button-downs, vests, or any open outerwear',
      '     2. If outer layers exist, examine the logo carefully:',
      '        a) Is the logo confined to the base shirt/polo layer only?',
      '        b) Is the logo naturally obscured/hidden by the outer layer where they overlap?',
      '        c) Does ANY part of the logo appear ON or BLEEDING ONTO the outer layer fabric?',
      '   - **REJECT (Answer NO) if ANY of these are true**:',
      '     • The logo appears ON TOP of the outer layer (jacket lapels, collar, sleeves)',
      '     • The logo bleeds through or spills over from the base layer onto the outer layer',
      '     • The logo is visible on BOTH the base shirt AND the jacket/outer layer simultaneously',
      '     • The logo appears to be printed across layer boundaries (spanning both base and outer garments)',
      '   - **APPROVE (Answer YES) if**:',
      '     • No outer layers are present (single-layer clothing like t-shirt, polo, hoodie, dress)',
      '     • Logo is fully confined to the visible base layer area with NO spillover onto outer garments',
      '     • The logo is PARTIALLY visible (some parts hidden by the outer layer) - this is CORRECT and REALISTIC',
      '     • The outer layer naturally covers/obscures portions of the logo - this is EXPECTED behavior',
      '   - **KEY DISTINCTION**: Partial logo visibility (logo cut off by outer layer) = GOOD ✓ | Logo spillover (logo appearing on outer layer) = BAD ✗',
      '   - This check ensures realistic layer hierarchy and prevents compositing artifacts'
    )
  } else {
    baseInstructions.push(
      '',
      '9. branding_logo_matches: N/A (no clothing logo required for Step 1a)',
      '   - If the generation prompt mentions logos for background/element placement, IGNORE those.',
      '   - Background/element logos are handled in Step 1b/Step 3, not Step 1a.',
      '10. branding_positioned_correctly: N/A (no clothing logo required for Step 1a)',
      '11. branding_scene_aligned: N/A (no clothing logo required for Step 1a)',
      '12. clothing_logo_no_overflow: N/A (no clothing logo required for Step 1a)'
    )
  }

  baseInstructions.push(
    '',
    'Return ONLY valid JSON with all fields and an explanations object.',
    'Example format:',
    '{',
    '  "is_fully_generated": "YES",',
    '  "composition_matches_shot": "N/A",',
    '  "identity_preserved": "YES",',
    '  "proportions_realistic": "YES",',
    '  "no_unauthorized_accessories": "YES",',
    '  "no_unauthorized_add-ons": "YES",',
    '  "no_visible_reference_labels": "YES",',
    '  "custom_background_matches": "N/A",',
    '  "branding_logo_matches": "N/A",',
    '  "branding_positioned_correctly": "N/A",',
    '  "branding_scene_aligned": "N/A",',
    '  "clothing_logo_no_overflow": "N/A",',
    '  "explanations": {',
    '    "dimensions_and_aspect_correct": "N/A (not evaluated in Step 1a)",',
    '    "is_fully_generated": "Fully AI-generated, no selfie portions visible",',
    '    "no_visible_reference_labels": "No reference labels detected",',
    '    "custom_background_matches": "Custom background properly applied",',
    '    ...',
    '  }',
    '}'
  )

  const parts: Part[] = [{ text: baseInstructions.join('\n') }]

  // Add context about what to ignore from the prompt
  parts.push({
    text: `IMPORTANT CONTEXT FOR EVALUATION:
- Step 1a generates ONLY the person on a grey background.
- The generation prompt below may mention custom backgrounds or background/element logos.
- IGNORE any background-related instructions - those are handled in Step 1b/Step 3.
- IGNORE any logo instructions for background/element placement - those are handled in Step 1b/Step 3.
- Only evaluate: person quality, clothing logos (if present), and grey background.
- The generation prompt is provided for context about shot type and subject details only.
${clothingLogoReference ? '\n**CRITICAL**: Check the generation prompt for clothing style (business, business-casual, startup, etc.). If the style involves LAYERED CLOTHING (jackets, blazers, cardigans over shirts), be EXTRA VIGILANT about logo overflow. The logo should ONLY appear on the base layer visible beneath the outer garment.' : ''}

Generation prompt used:\n${generationPrompt}`
  })

  parts.push({
    text: `Candidate image variation`
  })
  parts.push({
    inlineData: { mimeType: 'image/png', data: imageBase64 }
  })

  if (selfieComposite) {
    parts.push({
      text:
        selfieComposite.description ??
        'Composite reference containing labeled selfies and brand placement guidance.'
    })
    parts.push({
      inlineData: { mimeType: selfieComposite.mimeType, data: selfieComposite.base64 }
    })
  }

  if (garmentCollageReference) {
    parts.push({
      text: garmentCollageReference.description ?? 'Garment collage showing authorized clothing and accessories for this outfit.'
    })
    parts.push({
      inlineData: { mimeType: garmentCollageReference.mimeType, data: garmentCollageReference.base64 }
    })
  }

  if (clothingLogoReference) {
    parts.push({
      text: clothingLogoReference.description ?? 'Official branding/logo asset for comparison.'
    })
    parts.push({
      inlineData: { mimeType: clothingLogoReference.mimeType, data: clothingLogoReference.base64 }
    })
  }

  const contents: Content[] = [
    {
      role: 'user',
      parts
    }
  ]

  let rawResponse: unknown = null
  let structuredEvaluation: StructuredEvaluation | null = null
  let evalDurationMs = 0
  let usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined

  const evalStartTime = Date.now()
  try {
    const response: GenerateContentResult = await model.generateContent({
      contents,
      generationConfig: {
        temperature: AI_CONFIG.EVALUATION_TEMPERATURE
      }
    })

    evalDurationMs = Date.now() - evalStartTime
    usageMetadata = response.response.usageMetadata
    const responseParts = response.response.candidates?.[0]?.content?.parts ?? []
    const textPart = responseParts.find((part) => Boolean(part.text))?.text ?? ''
    rawResponse = textPart

    if (textPart) {
      structuredEvaluation = parseStructuredEvaluation(textPart)
    }

    // Note: Cost tracking moved to after evaluation status is determined
    // (see below after finalStatus is computed)
  } catch (error) {
    const evalDurationMs = Date.now() - evalStartTime
    Logger.error('Failed to run Gemini evaluation for V3 Step 1a', {
      error: error instanceof Error ? error.message : String(error)
    })

    // Track failed evaluation cost
    if (input.onCostTracking) {
      try {
        await input.onCostTracking({
          stepName: 'step1a-eval',
          reason: 'evaluation',
          result: 'failure',
          model: 'gemini-2.5-flash',
          durationMs: evalDurationMs,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 1a Eval: Failed to track failed evaluation cost', {
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }

    throw error
  }

  // Default to rejection if parsing failed
  if (!structuredEvaluation) {
    const rejectionReason = 'Evaluation did not return a valid structured response.'
    
    // Track evaluation cost with rejection
    if (input.onCostTracking && usageMetadata) {
      try {
        await input.onCostTracking({
          stepName: 'step1a-eval',
          reason: 'evaluation',
          result: 'success',
          model: 'gemini-2.5-flash',
          inputTokens: usageMetadata.promptTokenCount,
          outputTokens: usageMetadata.candidatesTokenCount,
          durationMs: evalDurationMs,
          evaluationStatus: 'rejected',
          rejectionReason,
          intermediateS3Key: input.intermediateS3Key,
        })
      } catch (costError) {
        Logger.error('V3 Step 1a Eval: Failed to track evaluation cost for parsing failure', {
          error: costError instanceof Error ? costError.message : String(costError),
        })
      }
    }
    
    const result: ImageEvaluationResult = {
      status: 'Not Approved',
      reason: rejectionReason,
      rawResponse,
      details: {
        actualWidth,
        actualHeight,
        dimensionMismatch,
        aspectMismatch,
        selfieDuplicate,
        matchingReferenceLabel: matchingReference?.label ?? null,
        uncertainCount: undefined,
        autoReject: undefined
      }
    }
    return { evaluation: result }
  }

  // Dimensions/aspect check removed from prompt - automatically approve
  structuredEvaluation.dimensions_and_aspect_correct = 'YES'
  structuredEvaluation.explanations.dimensions_and_aspect_correct = 'N/A (not evaluated in Step 1a - dimensions checked programmatically)'

  // Force custom_background_matches to N/A (Step 1a only has grey background)
  structuredEvaluation.custom_background_matches = 'N/A'
  structuredEvaluation.explanations.custom_background_matches = 'Step 1a generates only the person on grey background. Custom backgrounds are handled in Step 1b/Step 3.'

  // Force branding fields to N/A if no clothing logo reference (background/element logos handled in Step 1b/Step 3)
  if (!clothingLogoReference) {
    structuredEvaluation.branding_logo_matches = 'N/A'
    structuredEvaluation.branding_positioned_correctly = 'N/A'
    structuredEvaluation.branding_scene_aligned = 'N/A'
    structuredEvaluation.clothing_logo_no_overflow = 'N/A'
    structuredEvaluation.explanations.branding_logo_matches = 'No clothing logo required for Step 1a. Background/element logos are handled in Step 1b/Step 3.'
    structuredEvaluation.explanations.branding_positioned_correctly = 'N/A - No clothing logo required for Step 1a'
    structuredEvaluation.explanations.branding_scene_aligned = 'N/A - No clothing logo required for Step 1a'
    structuredEvaluation.explanations.clothing_logo_no_overflow = 'N/A - No clothing logo required for Step 1a'
  }

  // Override if exact selfie duplicate detected
  if (selfieDuplicate) {
    structuredEvaluation.is_fully_generated = 'NO'
    structuredEvaluation.explanations.is_fully_generated =
      `Generated image matches reference selfie ${matchingReference?.label ?? 'unknown'} exactly (base64 match)`
  }

  // Auto-reject conditions
  // Note: Only check branding criteria if clothingLogoReference is present
  // Background/element logos are handled in Step 1b/Step 3, not Step 1a
  const autoReject = [
    // dimensions_and_aspect_correct is N/A for Step 1a
    structuredEvaluation.is_fully_generated === 'NO',
    structuredEvaluation.is_fully_generated === 'UNCERTAIN', // Critical field
    // composition_matches_shot temporarily disabled - not checking
    structuredEvaluation.identity_preserved === 'NO',
    structuredEvaluation.proportions_realistic === 'NO',
    structuredEvaluation.no_unauthorized_accessories === 'NO',
    structuredEvaluation.no_unauthorized_accessories === 'UNCERTAIN', // Critical field - auto-reject uncertainty
    structuredEvaluation.no_visible_reference_labels === 'NO',
    structuredEvaluation.no_visible_reference_labels === 'UNCERTAIN', // Critical field - auto-reject uncertainty
    // custom_background_matches N/A for Step 1a - ignore any NO/UNCERTAIN values
    // Only check branding criteria if clothingLogoReference is present
    clothingLogoReference && structuredEvaluation.branding_logo_matches === 'NO',
    clothingLogoReference && structuredEvaluation.branding_positioned_correctly === 'NO',
    clothingLogoReference && structuredEvaluation.branding_scene_aligned === 'NO',
    clothingLogoReference && structuredEvaluation.clothing_logo_no_overflow === 'NO' // Critical: Logo must not overflow onto outer layers
  ].some(Boolean)

  // Count uncertain responses
  const uncertainCount = Object.values(structuredEvaluation).filter((v) => v === 'UNCERTAIN').length

  // Approval: ALL must be YES (or N/A)
  const allApproved =
    // dimensions_and_aspect_correct is N/A for Step 1a
    structuredEvaluation.is_fully_generated === 'YES' &&
    // composition_matches_shot temporarily disabled - always treated as approved
    (structuredEvaluation.composition_matches_shot === 'YES' || structuredEvaluation.composition_matches_shot === 'N/A') &&
    structuredEvaluation.identity_preserved === 'YES' &&
    structuredEvaluation.proportions_realistic === 'YES' &&
    structuredEvaluation.no_unauthorized_accessories === 'YES' &&
    structuredEvaluation.no_visible_reference_labels === 'YES' &&
    // custom_background_matches is N/A
    (structuredEvaluation.branding_logo_matches === 'YES' ||
      structuredEvaluation.branding_logo_matches === 'N/A') &&
    (structuredEvaluation.branding_positioned_correctly === 'YES' ||
      structuredEvaluation.branding_positioned_correctly === 'N/A') &&
    (structuredEvaluation.branding_scene_aligned === 'YES' ||
      structuredEvaluation.branding_scene_aligned === 'N/A') &&
    (structuredEvaluation.clothing_logo_no_overflow === 'YES' ||
      structuredEvaluation.clothing_logo_no_overflow === 'N/A') &&
    uncertainCount === 0

  const finalStatus: 'Approved' | 'Not Approved' = autoReject || !allApproved ? 'Not Approved' : 'Approved'

  // Build detailed reason from failed criteria
  const failedCriteria: string[] = []
  Object.entries(structuredEvaluation).forEach(([key, value]) => {
    if (key === 'explanations') return
    if (value === 'NO' || value === 'UNCERTAIN') {
      const explanation = structuredEvaluation!.explanations[key] || 'No explanation provided'
      failedCriteria.push(`${key}: ${value} (${explanation})`)
    }
  })

  const finalReason =
    failedCriteria.length > 0
      ? failedCriteria.join(' | ')
      : 'All criteria met'

  Logger.debug('V3 Step 1a Eval: Evaluation completed', {
    status: finalStatus,
    reason: finalReason.substring(0, 100),
    uncertainCount,
    autoReject
  })

  // Track evaluation cost with outcome
  if (input.onCostTracking && usageMetadata) {
    try {
      await input.onCostTracking({
        stepName: 'step1a-eval',
        reason: 'evaluation',
        result: 'success',
        model: 'gemini-2.5-flash',
        inputTokens: usageMetadata.promptTokenCount,
        outputTokens: usageMetadata.candidatesTokenCount,
        durationMs: evalDurationMs,
        evaluationStatus: finalStatus === 'Approved' ? 'approved' : 'rejected',
        rejectionReason: finalStatus === 'Not Approved' ? finalReason : undefined,
        intermediateS3Key: input.intermediateS3Key,
      })
      Logger.debug('V3 Step 1a Eval: Cost tracking with outcome recorded', {
        generationId: input.generationId,
        evaluationStatus: finalStatus,
        s3Key: input.intermediateS3Key,
      })
    } catch (costError) {
      Logger.error('V3 Step 1a Eval: Failed to track evaluation cost', {
        error: costError instanceof Error ? costError.message : String(costError),
        generationId: input.generationId,
      })
    }
  }

  return {
    evaluation: {
      status: finalStatus,
      reason: finalReason,
      rawResponse,
      structuredEvaluation,
      details: {
        actualWidth,
        actualHeight,
        dimensionMismatch,
        aspectMismatch,
        selfieDuplicate,
        matchingReferenceLabel: matchingReference?.label ?? null,
        uncertainCount,
        autoReject
      }
    }
  }
}

// --- Helper Functions (Inlined) ---

function parseStructuredEvaluation(text: string): StructuredEvaluation | null {
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    Logger.warn('No JSON found in evaluation response', { response: text })
    return null
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Normalize and validate all required fields
    const evaluation: StructuredEvaluation = {
      dimensions_and_aspect_correct: normalizeYesNo(parsed.dimensions_and_aspect_correct),
      is_fully_generated: normalizeYesNoUncertain(parsed.is_fully_generated),
      composition_matches_shot: 'N/A' as const, // Temporarily disabled
      identity_preserved: normalizeYesNoUncertain(parsed.identity_preserved),
      proportions_realistic: normalizeYesNoUncertain(parsed.proportions_realistic),
      no_unauthorized_accessories: normalizeYesNoUncertain(parsed.no_unauthorized_accessories),
      no_visible_reference_labels: normalizeYesNoUncertain(parsed.no_visible_reference_labels),
      custom_background_matches: normalizeYesNoNA(parsed.custom_background_matches),
      branding_logo_matches: normalizeYesNoNA(parsed.branding_logo_matches),
      branding_positioned_correctly: normalizeYesNoNA(parsed.branding_positioned_correctly),
      branding_scene_aligned: normalizeYesNoNA(parsed.branding_scene_aligned),
      clothing_logo_no_overflow: normalizeYesNoNA(parsed.clothing_logo_no_overflow),
      explanations:
        typeof parsed.explanations === 'object' && parsed.explanations !== null
          ? (parsed.explanations as Record<string, string>)
          : {}
    }

    return evaluation
  } catch (error) {
    Logger.warn('Failed to parse structured evaluation JSON', {
      error: error instanceof Error ? error.message : String(error),
      response: text
    })
    return null
  }
}

function normalizeYesNo(value: unknown): 'YES' | 'NO' {
  if (typeof value !== 'string') {
    return 'NO'
  }
  const normalized = value.trim().toUpperCase()
  return normalized === 'YES' ? 'YES' : 'NO'
}

function normalizeYesNoUncertain(value: unknown): 'YES' | 'NO' | 'UNCERTAIN' {
  if (typeof value !== 'string') {
    return 'UNCERTAIN'
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'UNCERTAIN'
}

function normalizeYesNoNA(value: unknown): 'YES' | 'NO' | 'N/A' {
  if (typeof value !== 'string') {
    return 'N/A'
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === 'YES') return 'YES'
  if (normalized === 'NO') return 'NO'
  return 'N/A'
}
