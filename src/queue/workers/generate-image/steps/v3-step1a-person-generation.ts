import { Logger } from '@/lib/logger'
import { Env } from '@/lib/env'
import { generateWithGemini } from '../gemini'
import sharp from 'sharp'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import {
  type ReferenceImage
} from '../utils/reference-builder'
import { logDebugPrompt } from '../utils/debug-helpers'
import { logPrompt, logStepResult } from '../utils/logging'
import { AI_CONFIG, STAGE_MODEL, STAGE_RESOLUTION } from '../config'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { CostTrackingHandler } from '../workflow-v3'
import { isFeatureEnabled } from '@/config/feature-flags'
import {
  compositionRegistry,
  type ElementContext,
} from '@/domain/style/elements/composition'
import { hasValue } from '@/domain/style/elements/base/element-types'
import {
  resolveShotType,
  buildBodyBoundaryInstruction,
  getShotTypeIntroContext
} from '@/domain/style/elements/shot-type/config'
import {
  formatDemographicsForPrompt,
  type DemographicProfile
} from '@/domain/selfie/selfieDemographics'

export interface V3Step1aInput {
  selfieReferences: ReferenceImage[]
  selfieComposite: ReferenceImage
  faceComposite?: ReferenceImage // Split face composite (front_view + side_view selfies)
  bodyComposite?: ReferenceImage // Split body composite (partial_body + full_body selfies)
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  aspectRatioConfig: { id: string; width: number; height: number }
  expectedWidth: number
  expectedHeight: number
  prompt: string // JSON string - contains framing.shot_type, subject, etc
  mustFollowRules: string[]
  freedomRules: string[]
  generationId: string
  personId: string
  teamId?: string
  debugMode: boolean
  evaluationFeedback?: { suggestedAdjustments?: string }
  selfieAssetIds?: string[]
  demographics?: DemographicProfile // Aggregated demographics for prompt context
  onCostTracking?: CostTrackingHandler
  referenceImages?: BaseReferenceImage[] // Pre-built reference images (e.g., garment collage from outfit1)
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset> // Assets from step 0 preparation
}

export interface V3Step1aOutput {
  imageBuffer: Buffer
  imageBase64: string
  allImageBuffers: Buffer[] // All images returned by the model (for debugging)
  assetId?: string // Asset ID for the generated person-on-grey intermediate
  clothingLogoReference?: BaseReferenceImage // Logo used in generation (for Step 2 evaluation)
  backgroundLogoReference?: BaseReferenceImage // Logo for background/elements (for Step 3 composition)
  backgroundBuffer?: Buffer
  selfieComposite: BaseReferenceImage
  faceComposite?: BaseReferenceImage // Split face composite for Step 2 refinement
  bodyComposite?: BaseReferenceImage // Split body composite for Step 2 refinement
  reused?: boolean // Whether this asset was reused from cache
}

/**
 * Prepare all reference images for V3 Step 1a person generation (grey background only)
 */
async function prepareAllReferences({
  selfieReferences,
  selfieComposite,
  styleSettings,
  downloadAsset,
  generationId,
  preparedAssets
}: {
  selfieReferences: ReferenceImage[]
  selfieComposite: ReferenceImage
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  generationId?: string
  preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset>
}): Promise<{
  referenceImages: BaseReferenceImage[]
  logoReference?: BaseReferenceImage
  logoReferenceForEval?: BaseReferenceImage
  selfieComposite: BaseReferenceImage
}> {
  // 1. Log info about provided selfie composite
  Logger.debug('V3 Step 1a: Using provided selfie composite reference', {
    generationId,
    selfieCount: selfieReferences.length,
    selfieLabels: selfieReferences.map(ref => ref.label || 'NO_LABEL'),
    compositeMimeType: selfieComposite.mimeType,
    compositeBase64Length: selfieComposite.base64.length
  })

  // 2. Check if clothing overlay is being used (from ClothingOverlayElement)
  // If overlay exists, skip logo loading FOR GENERATION (overlay already has logo)
  // but still load it FOR EVALUATION (so evaluator knows logo is authorized)
  const hasClothingOverlay = preparedAssets?.has('clothing-overlay-overlay')

  // 3. Load logo reference for generation AND/OR evaluation
  let logoReference: BaseReferenceImage | undefined
  let logoReferenceForEval: BaseReferenceImage | undefined
  if (
    hasValue(styleSettings.branding) &&
    styleSettings.branding.value.type === 'include' &&
    styleSettings.branding.value.position === 'clothing'
  ) {
    // Use prepared logo from BrandingElement (Step 0) - already has SVG conversion
    const preparedLogo = preparedAssets?.get('branding-logo')
    if (preparedLogo?.data.base64) {
      const logoRef = {
        description: 'Company logo for clothing branding - apply according to branding rules',
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png'
      }

      // Always save for evaluation (so evaluator knows logo is authorized)
      logoReferenceForEval = logoRef

      if (!hasClothingOverlay) {
        // Only pass to generation if NOT using clothing overlay
        logoReference = logoRef
        Logger.debug('V3 Step 1a: Using prepared logo asset for clothing branding', {
          generationId,
          mimeType: preparedLogo.data.mimeType,
          s3Key: preparedLogo.data.s3Key
        })
      } else {
        Logger.info('V3 Step 1a: Logo reference loaded for eval only - clothing overlay handles generation', {
          generationId,
          overlayKey: 'clothing-overlay-overlay'
        })
      }
    } else {
      Logger.warn('V3 Step 1a: Prepared logo asset not found, branding may not appear', {
        generationId,
        hasPreparedAssets: !!preparedAssets,
        preparedAssetKeys: Array.from(preparedAssets?.keys() || [])
      })
    }
  }

  // 4. REMOVED: Outfit reference loading (now handled by outfit1/server.ts)
  // Custom clothing (outfit transfer) is package-specific (outfit1 only).
  // The outfit1 package creates a garment collage during buildGenerationPayload()
  // and passes it via input.referenceImages to avoid duplicate loading.
  // This keeps prepareAllReferences() generic for all packages.

  // 5. Assemble reference array - selfies and optional logo
  // Format frame removed from Step 1a to avoid AI reproducing borders
  // Step 2 will handle final framing
  const referenceImages: BaseReferenceImage[] = [selfieComposite]

  if (logoReference) {
    referenceImages.push(logoReference)
  }

  Logger.debug('V3 Step 1a: Prepared references for person generation (no format frame)', {
    generationId,
    totalReferences: referenceImages.length,
    hasLogo: !!logoReference
  })

  return { referenceImages, logoReference, logoReferenceForEval, selfieComposite }
}

/**
 * Compose element contributions for person generation phase
 *
 * Uses the element composition system to build prompt rules from independent elements.
 * This provides better separation of concerns and makes the prompt system more modular.
 */
async function composeElementContributions(
  styleSettings: PhotoStyleSettings,
  generationContext: {
    selfieS3Keys: string[]
    generationId?: string
    personId?: string
    teamId?: string
    preparedAssets?: Map<string, import('@/domain/style/elements/composition').PreparedAsset>
    hasFaceComposite?: boolean  // Whether face composite reference is available
    hasBodyComposite?: boolean  // Whether body composite reference is available
  }
): Promise<{
  instructions: string[]
  mustFollow: string[]
  freedom: string[]
  referenceImages: BaseReferenceImage[]
}> {
  // Create element context for person-generation phase
  const elementContext: ElementContext = {
    phase: 'person-generation',
    settings: styleSettings,
    generationContext: {
      selfieS3Keys: generationContext.selfieS3Keys,
      personId: generationContext.personId, // Primary identifier - invited users don't have userId
      teamId: generationContext.teamId,
      generationId: generationContext.generationId,
      preparedAssets: generationContext.preparedAssets, // Pass prepared assets from step 0
    },
    existingContributions: [],
  }

  // Compose contributions from all relevant elements
  const contributions = await compositionRegistry.composeContributions(elementContext)

  Logger.debug('[ElementComposition] Step 1a contributions composed', {
    generationId: generationContext.generationId,
    instructionCount: contributions.instructions?.length || 0,
    mustFollowCount: contributions.mustFollow?.length || 0,
    freedomCount: contributions.freedom?.length || 0,
    referenceImagesCount: contributions.referenceImages?.length || 0,
    preparedAssetsUsed: generationContext.preparedAssets?.size || 0,
  })

  return {
    instructions: contributions.instructions || [],
    mustFollow: contributions.mustFollow || [],
    freedom: contributions.freedom || [],
    referenceImages: (contributions.referenceImages as unknown as BaseReferenceImage[]) || [],
  }
}

/**
 * V3 Step 1a: Generate person on grey background
 * Creates ONLY the person without any background complexity to let the model focus on the face
 * Now includes fingerprinting and reuse detection for cost optimization
 */
export async function executeV3Step1a(
  input: V3Step1aInput
): Promise<V3Step1aOutput> {
  const {
    selfieReferences,
    selfieComposite,
    faceComposite, // Split face composite (front_view + side_view selfies)
    bodyComposite, // Split body composite (partial_body + full_body selfies)
    styleSettings,
    downloadAsset,
    aspectRatio,
    aspectRatioConfig,
    prompt,
    mustFollowRules,
    freedomRules,
    debugMode,
    evaluationFeedback,
    selfieAssetIds,
    demographics, // Aggregated demographics for prompt context
    personId,
    generationId,
    onCostTracking,
    preparedAssets
  } = input

  Logger.debug('V3 Step 1a: Generating person on grey background')

  // PHASE 1: Check for reusable asset via fingerprinting
  // Note: This phase is optional and failures here should not prevent generation
  if (selfieAssetIds && selfieAssetIds.length > 0) {
    try {
      // Extract style parameters for fingerprinting
      const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)

      // Only proceed with fingerprinting if prompt parsing succeeded
      // Create fingerprint for person-on-grey step
      const fingerprint = StyleFingerprintService.createPersonFingerprint(
        selfieAssetIds,
        {
          aspectRatio: aspectRatio,
          expression: styleParams.expression,
          pose: styleParams.pose,
          shotType: styleParams.shotType,
          clothingType: styleParams.clothingType,
          clothingColor: styleParams.clothingColor,
          lighting: styleParams.lighting,
        }
      )

      Logger.debug('V3 Step 1a: Created fingerprint for person-on-grey', {
        fingerprint,
        selfieAssetIds,
        generationId,
      })

      // DISABLED: Asset reuse is temporarily disabled
      // We still create fingerprints for tracking/analytics, but don't reuse assets during generation
      // TODO: Re-enable reuse when ready
      //
      // Check for reusable asset (commented out)
      // const reusedAsset = await AssetService.findReusableAsset(fingerprint, {
      //   teamId: teamId,
      //   personId: personId,
      // })
      //
      // if (reusedAsset) {
      //   Logger.info('V3 Step 1a: Reusing existing person-on-grey asset', {
      //     assetId: reusedAsset.id,
      //     fingerprint,
      //     generationId,
      //   })
      //   // ... reuse logic ...
      //   return { ... }
      // }

      Logger.debug('V3 Step 1a: Skipping asset reuse (disabled), will generate new', {
        fingerprint,
        generationId,
      })
    } catch (error) {
      Logger.warn('V3 Step 1a: Fingerprinting/reuse check failed, continuing with generation', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // PHASE 2: Generate new asset (original logic)

  // Parse prompt to extract shot type (no longer passed as separate arg)
  // This parse is required for generation, so if it fails, we should throw
  let promptObj: Record<string, unknown>
  try {
    promptObj = JSON.parse(prompt)
  } catch (parseError) {
    Logger.error('V3 Step 1a: Failed to parse prompt JSON - this is required for generation', {
      error: parseError instanceof Error ? parseError.message : String(parseError),
      generationId,
      promptPreview: prompt.substring(0, 200),
    })
    throw new Error(`V3 Step 1a: Invalid prompt JSON format: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
  }
  const shotDescription = (promptObj.framing as { shot_type?: string } | undefined)?.shot_type || 'medium-shot'

  // Resolve the full shot type config for body boundary enforcement
  const shotTypeConfig = resolveShotType(shotDescription)
  const shotTypeIntroContext = getShotTypeIntroContext(shotTypeConfig)
  const bodyBoundaryInstruction = buildBodyBoundaryInstruction(shotTypeConfig)

  // Prepare references (selfies, optional logo for clothing branding, and format - no background yet)
  const { referenceImages: preparedReferences, logoReference, logoReferenceForEval } = await prepareAllReferences({
    selfieReferences,
    selfieComposite,
    styleSettings,
    downloadAsset,
    generationId: `v3-step1-${Date.now()}`,
    preparedAssets  // Pass prepared assets to check for clothing overlay
  })

  // Merge pre-built references (e.g., garment collage from outfit1) with prepared references
  // Pre-built references come first as they are primary (e.g., outfit collage before logo)
  // IMPORTANT: Filter out selfie composite from input.referenceImages to avoid duplication
  // since prepareAllReferences already includes it
  const filteredInputReferences = (input.referenceImages || []).filter(ref => {
    const desc = ref.description?.toLowerCase() || ''
    // Exclude selfie composite (it's in preparedReferences already)
    return !desc.includes('composite image containing') && !desc.includes('stacked subject selfies')
  })
  
  // Determine if we have any split composites
  // If we have ANY split composite, the combined composite is redundant:
  // - If we have both face + body: combined is just face + body stacked differently
  // - If we have only face: combined = face (identical)
  // - If we have only body: combined = body (identical)
  // Combined is only useful when NO selfies are classified (no split composites at all)
  const hasAnySplitComposite = !!faceComposite || !!bodyComposite

  // Filter out combined selfie composite from preparedReferences when we have any split composite
  const filteredPreparedReferences = hasAnySplitComposite
    ? preparedReferences.filter(ref => {
        const desc = ref.description?.toLowerCase() || ''
        // Remove the combined composite (it contains "stacked" or "composite image containing")
        return !desc.includes('stacked subject selfies') && !desc.includes('composite image containing')
      })
    : preparedReferences

  const referenceImages = [
    ...filteredInputReferences, // Pre-built references from package (outfit1 garment collage, format frame, etc.)
    ...filteredPreparedReferences  // Prepared references (logo for clothing branding, and selfie composite only if needed)
  ]

  // Add split composites when available (face and body separated for better accuracy)
  if (faceComposite) {
    referenceImages.push(faceComposite)
    Logger.debug('V3 Step 1a: Added face composite to references', {
      generationId,
      description: faceComposite.description?.substring(0, 80)
    })
  }
  if (bodyComposite) {
    referenceImages.push(bodyComposite)
    Logger.debug('V3 Step 1a: Added body composite to references', {
      generationId,
      description: bodyComposite.description?.substring(0, 80)
    })
  }

  Logger.debug('V3 Step 1a: Merged reference images', {
    generationId: `v3-step1-${Date.now()}`,
    inputReferencesCount: input.referenceImages?.length || 0,
    filteredInputReferencesCount: filteredInputReferences.length,
    preparedReferencesCount: preparedReferences.length,
    filteredPreparedReferencesCount: filteredPreparedReferences.length,
    hasFaceComposite: !!faceComposite,
    hasBodyComposite: !!bodyComposite,
    hasAnySplitComposite,
    combinedCompositeIncluded: !hasAnySplitComposite,
    finalReferenceCount: referenceImages.length,
    finalDescriptions: referenceImages.map(r => r.description?.substring(0, 50))
  })

  // Compose element contributions if feature flag is enabled
  let elementContributions: {
    instructions: string[]
    mustFollow: string[]
    freedom: string[]
    referenceImages: BaseReferenceImage[]
  } | null = null

  if (isFeatureEnabled('elementComposition')) {
    Logger.info('[ElementComposition] Feature flag enabled, composing element contributions for Step 1a')
    try {
      elementContributions = await composeElementContributions(styleSettings, {
        selfieS3Keys: input.selfieReferences.map(r => r.label || ''),
        generationId,
        personId,
        teamId: input.teamId,
        preparedAssets, // Pass prepared assets from step 0
        hasFaceComposite: !!faceComposite,
        hasBodyComposite: !!bodyComposite
      })
      Logger.debug('[ElementComposition] Element contributions composed successfully', {
        generationId,
        hasInstructions: elementContributions.instructions.length > 0,
        hasMustFollow: elementContributions.mustFollow.length > 0,
        hasFreedom: elementContributions.freedom.length > 0,
        hasReferenceImages: elementContributions.referenceImages.length > 0,
        preparedAssets: preparedAssets?.size || 0,
      })

      // Add element contribution reference images (e.g., clothing overlay)
      // Convert from element contribution format to BaseReferenceImage format
      if (elementContributions.referenceImages.length > 0) {
        for (const ref of elementContributions.referenceImages) {
          // Element contributions use url/type format, convert to base64/mimeType format
          if ('url' in ref && typeof ref.url === 'string') {
            // Parse data URL: data:image/png;base64,<base64data>
            const dataUrlMatch = ref.url.match(/^data:([^;]+);base64,(.+)$/)
            if (dataUrlMatch) {
              const [, mimeType, base64] = dataUrlMatch
              referenceImages.push({
                description: ref.description,
                base64,
                mimeType,
              })
            } else {
              Logger.warn('[ElementComposition] Could not parse data URL from element contribution', {
                generationId,
                url: ref.url?.substring(0, 100)
              })
            }
          } else if ('base64' in ref && 'mimeType' in ref) {
            // Already in correct format
            referenceImages.push(ref as BaseReferenceImage)
          }
        }
        Logger.debug('[ElementComposition] Added references', { count: elementContributions.referenceImages.length })
      }
    } catch (error) {
      Logger.error('[ElementComposition] Failed to compose element contributions, falling back to provided rules', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
      // Fall back to provided rules on error
      elementContributions = null
    }
  }

  // Use element contributions if available, otherwise use provided rules
  const effectiveMustFollowRules = elementContributions?.mustFollow || mustFollowRules
  const effectiveFreedomRules = elementContributions?.freedom || freedomRules

  // Rules source logging at debug level

  // Extract garment description from preparedAssets (generated in Step 0)
  let garmentAnalysisFromStep0: Record<string, unknown> | undefined
  if (preparedAssets) {
    const collageAsset = preparedAssets.get('custom-clothing-garment-collage')
    const garmentDescription = collageAsset?.data?.metadata?.garmentDescription as {
      items: unknown[]
      overallStyle: string
      colorPalette: string[]
      layering: string
      hasLogo: boolean
      logoDescription?: string
    } | undefined

    if (garmentDescription) {
      garmentAnalysisFromStep0 = {
        items: garmentDescription.items,
        overallStyle: garmentDescription.overallStyle,
        colorPalette: garmentDescription.colorPalette,
        layering: garmentDescription.layering,
        hasLogo: garmentDescription.hasLogo,
        logoDescription: garmentDescription.logoDescription,
      }
      Logger.debug('V3 Step 1a: Using garment analysis from Step 0', { items: garmentDescription.items?.length || 0 })
    }
  }

  // Build wardrobe section - merge existing wardrobe with garment analysis from Step 0
  const existingWardrobe = promptObj.wardrobe as Record<string, unknown> | undefined
  const wardrobeSection = existingWardrobe ? {
    ...existingWardrobe,
    // Add garment analysis from Step 0 (overrides any existing garmentAnalysis)
    garmentAnalysis: garmentAnalysisFromStep0,
  } : garmentAnalysisFromStep0 ? {
    garmentAnalysis: garmentAnalysisFromStep0,
  } : undefined

  // Create a simplified prompt object.
  // Step 1a is an intermediate "person on grey" asset; we keep camera for perspective consistency,
  // but use neutral/even base lighting so Step 2 can apply the final scene lighting.
  const personOnlyPrompt = {
    subject: promptObj.subject as Record<string, unknown> | undefined, // Keep subject details (clothing, pose, expression)
    framing: promptObj.framing as { shot_type?: string } | undefined, // Keep framing (shot type)
    camera: promptObj.camera as Record<string, unknown> | undefined, // Keep camera for perspective consistency (focal length, distance, angle)
    lighting: {
      quality: 'Neutral Even Light',
      direction: 'front',
      setup: ['Soft even key light', 'Gentle fill'],
      color_temperature: '5000K',
      description: 'Neutral, even base lighting suitable for later relighting during composition.',
      note: 'No visible studio equipment. No harsh shadows. Keep lighting clean and even on the subject.'
    },
    wardrobe: wardrobeSection, // Wardrobe with garment analysis from Step 0
    scene: {
      background: {
        type: 'solid',
        color: '#808080',
        description: 'Solid flat neutral grey background (#808080)'
      }
    }
    // Explicitly omit: rendering - these post-processing effects are for Step 2
  }

  // Compose prompt with simplified specifications
  const jsonPrompt = JSON.stringify(personOnlyPrompt, null, 2)

  // Check for clothing reference (overlay or garment collage)
  const hasClothingOverlay = preparedAssets?.has('clothing-overlay-overlay')
  const hasGarmentCollage = input.referenceImages?.some(ref =>
    ref.description?.toUpperCase().includes('GARMENT COLLAGE')
  )
  const hasClothingReference = hasClothingOverlay || hasGarmentCollage

  // Build HARD CONSTRAINTS dynamically
  const hardConstraints = [
    '**HARD CONSTRAINTS (Non-Negotiable):**',
    '1. **Framing:** ' + (bodyBoundaryInstruction || `Frame as ${shotDescription} per JSON framing section.`),
    '2. **Background:** Solid neutral grey (#808080) only. No gradients, props, environment, or text.',
  ]
  // Only add clothing constraint when clothing reference is provided
  if (hasClothingReference) {
    hardConstraints.push('3. **Clothing:** Use the clothing reference as PRIMARY source for all garment styling.')
  }
  hardConstraints.push('')

  const structuredPrompt = [
    // Section 1: Intro & Task
    `You are a world-class professional photographer creating ${shotTypeIntroContext} from the attached selfies.`,
    '',

    // Section 2: HARD CONSTRAINTS
    // NOTE: Identity, accessories, and equipment rules now come from SubjectElement and LightingElement
    ...hardConstraints,

    // Section 3: Composition JSON
    'Scene Specifications:',
    jsonPrompt,
    '',
  ]

  // Section 3.5: Demographics context (if available)
  const demographicsPrompt = demographics ? formatDemographicsForPrompt(demographics, 'person') : undefined
  if (demographicsPrompt) {
    structuredPrompt.push(demographicsPrompt)
    structuredPrompt.push('')
  }

  // Section 4: Technical Requirements
  // NOTE: Skin texture, hair, lighting, catchlights rules now come from SubjectElement and LightingElement
  structuredPrompt.push('Technical Requirements:')
  if (!elementContributions) {
    // Fallback if element composition not available
    structuredPrompt.push('- Realistic skin texture and hair (high-frequency details, natural imperfections, stray hairs).')
    structuredPrompt.push('- Neutral, even lighting (no harsh shadows). Final scene lighting applied in Step 2.')
    structuredPrompt.push('- Catchlights in eyes must be present and realistic.')
    structuredPrompt.push(`- Output: ${aspectRatioConfig.width}x${aspectRatioConfig.height}px (${aspectRatioConfig.id || aspectRatio}). Fill canvas edge-to-edge.`)
  }

  // Add element-specific must follow rules (filter out redundant framing rules)
  if (effectiveMustFollowRules && effectiveMustFollowRules.length > 0) {
    // Filter out body/framing rules that duplicate Hard Constraint #1
    const bodyFramingKeywords = ['body boundaries', 'must show', 'must not show', 'cut point', 'frame from', 'crop']
    const nonRedundantRules = effectiveMustFollowRules.filter(rule => {
      const lowerRule = rule.toLowerCase()
      return !bodyFramingKeywords.some(kw => lowerRule.includes(kw))
    })
    for (const rule of nonRedundantRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }

  // Section 5: Freedom Rules
  structuredPrompt.push('')
  structuredPrompt.push('Creative Latitude:')
  structuredPrompt.push('- Optimize lighting/shadows for realistic 3D volume and texture.')
  structuredPrompt.push('- Subtle color grading to enhance professional appearance.')

  // Add element-specific freedom rules (using effective rules from element composition or fallback)
  if (effectiveFreedomRules && effectiveFreedomRules.length > 0) {
    for (const rule of effectiveFreedomRules) {
      structuredPrompt.push(`- ${rule}`)
    }
  }

  // Add reference image usage instructions
  // NOTE: Selfie/face/body composite instructions now come from SubjectElement via element composition
  const instructionLines: string[] = [
    '\n\nReference images are supplied with clear labels. Follow each resource precisely:',
    '- **Neutral background:** Solid flat neutral grey background (#808080) only. No gradients, no props, no environment, and no text.',
    '- **Focus on person:** Prioritize identity, expression, pose, clothing accuracy, and correct framing. Keep the subject consistent with the JSON camera + lighting so Step 2 can composite cleanly.'
  ]

  // Add garment collage instructions if present (hasGarmentCollage computed earlier)
  if (hasGarmentCollage) {
    // Check if we have structured garment analysis from Step 0
    const hasGarmentAnalysis = !!garmentAnalysisFromStep0

    if (hasGarmentAnalysis) {
      instructionLines.push(
        '- **Garment Collage + Analysis:** Dress the person in the EXACT clothing items shown in the garment collage reference. The JSON `wardrobe.garmentAnalysis` section provides a detailed breakdown of each clothing item including category, type, color, material, and layering. Use BOTH the visual collage reference AND this structured data to ensure accurate clothing reproduction.',
        '- **Clothing Details:** Follow the garmentAnalysis.items array for precise item descriptions. Each item includes primary/secondary colors, pattern type, material, and notable details like buttons, pockets, or logos.',
        '- **Layering Order:** Follow the garmentAnalysis.layering description for how items should be worn over each other.'
      )
    } else {
      instructionLines.push(
        '- **Garment Collage:** Dress the person in the EXACT clothing items shown in the garment collage reference. Match the style, fit, and details of each garment precisely. Use the clothing_colors specified in the subject JSON for accurate color rendering (these are user-adjusted hex values and must be respected). Ensure professional fit and styling appropriate for business attire.'
      )
    }

    // Add specific instruction to ignore lower body parts of the collage for tighter shots
    if (['medium-close-up', 'close-up', 'extreme-close-up', 'medium-shot'].includes(shotDescription)) {
      instructionLines.push(
        `- **Shot Constraints vs Collage:** Since the requested shot is ${shotDescription.toUpperCase().replace('-', ' ')}, you must IGNORE any lower body garments (pants, shoes, skirts) visible in the garment collage. Focus ONLY on the upper body clothing (shirt, jacket, tie, etc.) that fits within the frame.`
      )
    }
  }

  if (logoReference) {
    instructionLines.push(
      '- **Branding:** Place the logo exactly once on the clothing following the BRANDING guidance from the reference assets. The logo should be part of the person\'s appearance.'
    )
  }

  structuredPrompt.push(...instructionLines)

  if (evaluationFeedback?.suggestedAdjustments) {
    structuredPrompt.push(`\n\nADJUSTMENTS FROM PREVIOUS ATTEMPT:\n${evaluationFeedback.suggestedAdjustments}`)
  }

  const compositionPrompt = structuredPrompt.join('\n')

  // Log prompt (improvement #10) - consolidated logging
  logPrompt('V3 Step 1a', compositionPrompt, generationId)
  
  // Log reference images summary
  Logger.info('V3 Step 1a: References', {
    count: referenceImages.length,
    types: referenceImages.map(img => img.description?.split(' ')[0] || 'unknown').join(', ')
  })

  // Generate with Gemini and track failures
  const step1aResolution = STAGE_RESOLUTION.STEP_1A_PERSON || '1K'
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>
  try {
    logPrompt('V3 Step 1a', compositionPrompt, generationId)
    generationResult = await generateWithGemini(
      compositionPrompt,
      referenceImages,
      aspectRatio,
      step1aResolution,
      {
        temperature: AI_CONFIG.PERSON_GENERATION_TEMPERATURE,
        stage: 'STEP_1A_PERSON',
      }
    )
  } catch (error) {
    const providerUsed = (error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed
    if (onCostTracking) {
      try {
        await onCostTracking({
          stepName: 'step1a-person',
          reason: 'generation',
          result: 'failure',
          model: STAGE_MODEL.STEP_1A_PERSON,
          provider: providerUsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 1a: Failed to track generation cost (failure case)', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId,
        })
      }
    }
    throw error
  }

  if (!generationResult.images.length) {
    Logger.error('V3 Step 1a: Gemini returned no images', {
      generationId,
      provider: generationResult.providerUsed,
      promptLength: compositionPrompt.length,
      referenceCount: referenceImages.length,
      aspectRatio,
    })
    throw new Error('V3 Step 1a: Gemini returned no images')
  }

  // Convert all images to PNG buffers (for debugging) - use first for pipeline
  const allPngBuffers = await Promise.all(
    generationResult.images.map(img => sharp(img).png().toBuffer())
  )
  const pngBuffer = allPngBuffers[0]

  logStepResult('V3 Step 1a', {
    success: true,
    provider: generationResult.providerUsed,
    model: STAGE_MODEL.STEP_1A_PERSON,
    imageSize: pngBuffer.length,
    durationMs: generationResult.usage.durationMs,
    imagesReturned: allPngBuffers.length, // How many images the model returned
  })

  // Track generation cost
  if (onCostTracking) {
    try {
      await onCostTracking({
        stepName: 'step1a-person',
        reason: 'generation',
        result: 'success',
        model: STAGE_MODEL.STEP_1A_PERSON,
        provider: generationResult.providerUsed,  // Pass actual provider used
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
      Logger.debug('V3 Step 1a: Cost tracking recorded', {
        generationId,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
      })
    } catch (error) {
      Logger.error('V3 Step 1a: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // PHASE 3: Create Asset and set fingerprint for future reuse
  let createdAssetId: string | undefined
  if (selfieAssetIds && selfieAssetIds.length > 0) {
    try {
      // First upload to S3 to get the key
      const intermediateS3Key = `generations/${personId}/${generationId}/intermediate/person-on-grey-${Date.now()}.png`

      // Note: The actual S3 upload will happen in the workflow layer
      // For now, we'll create the asset record assuming the upload will happen
      // In a real implementation, this should be coordinated with the upload

      Logger.debug('V3 Step 1a: Asset will be created after S3 upload in workflow layer', {
        generationId,
        intermediateS3Key,
      })

      // The asset creation will be handled by the workflow layer after upload
      // We'll return the necessary info for that

    } catch (error) {
      Logger.warn('V3 Step 1a: Asset tracking preparation failed', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  // Prepare assets for Step 2 and Step 3
  
  // 1. Keep clothing logo reference for evaluation (authorizes logo on clothing)
  // Use logoReferenceForEval which is set even when clothing overlay handles generation
  const clothingLogoRef = logoReferenceForEval
  
  // 2. Load custom background if specified (for Step 3)
  let backgroundBuffer: Buffer | undefined
  const bgValue = styleSettings.background?.value
  if (bgValue?.type === 'custom' && bgValue.key) {
    try {
      const bgAsset = await downloadAsset(bgValue.key)
      if (bgAsset) {
        backgroundBuffer = Buffer.from(bgAsset.base64, 'base64')
      }
    } catch (error) {
      Logger.warn('Failed to load background for Step 3', { error })
    }
  }

  // 3. Load logo ONLY if branding is for background/elements (NOT clothing) - for Step 3
  let backgroundLogoRef: BaseReferenceImage | undefined
  if (
    hasValue(styleSettings.branding) &&
    styleSettings.branding.value.type === 'include' &&
    (styleSettings.branding.value.position === 'background' || styleSettings.branding.value.position === 'elements')
  ) {
    // Use prepared logo from BrandingElement (Step 0) - already has SVG conversion
    const preparedLogo = preparedAssets?.get('branding-logo')
    if (preparedLogo?.data.base64) {
      backgroundLogoRef = {
        description: `Company logo for ${styleSettings.branding.value.position} placement`,
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png'
      }
      Logger.debug('V3 Step 1a: Using prepared logo asset for background/elements branding', {
        generationId,
        mimeType: preparedLogo.data.mimeType,
        position: styleSettings.branding.value.position
      })
    } else {
      Logger.warn('V3 Step 1a: Prepared logo asset not found for background/elements branding', {
        generationId,
        position: styleSettings.branding.value.position,
        preparedAssetKeys: Array.from(preparedAssets?.keys() || [])
      })
    }
  }

  return {
    imageBuffer: pngBuffer,
    imageBase64: pngBuffer.toString('base64'),
    allImageBuffers: allPngBuffers, // All images for debugging
    assetId: createdAssetId,
    clothingLogoReference: clothingLogoRef, // For Step 2 evaluation
    backgroundLogoReference: backgroundLogoRef, // For Step 3 composition
    backgroundBuffer,
    selfieComposite,
    faceComposite, // For Step 2 face refinement
    bodyComposite, // For Step 2 body verification
    reused: false,
  }
}

