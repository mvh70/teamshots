import { Logger } from '@/lib/logger'
import { extensionFromMimeType } from '@/lib/image-format'
import { generateWithGemini } from '../gemini'
import type { PhotoStyleSettings } from '@/types/photo-style'
import type { DownloadAssetFn } from '@/types/generation'
import type { ReferenceImage as BaseReferenceImage } from '@/types/generation'
import { type ReferenceImage } from '../utils/reference-builder'
import { asObject } from '../utils/type-helpers'
import { logPrompt, logStepResult } from '../utils/logging'
import { AI_CONFIG, STAGE_MODEL, STAGE_RESOLUTION } from '../config'
import { StyleFingerprintService } from '@/domain/services/StyleFingerprintService'
import type { CostTrackingHandler } from '../workflow-v3'
import { hasValue } from '@/domain/style/elements/base/element-types'
import {
  getStep1aBackgroundLogoReferenceDescription,
  getStep1aClothingLogoReferenceDescription,
} from '@/domain/style/elements/branding/prompt'
import { getClothingTemplateReferenceDescription } from '@/domain/style/elements/clothing/prompt'
import {
  resolveShotType,
  buildBodyBoundaryInstruction,
  getShotTypeIntroContext,
} from '@/domain/style/elements/shot-type/config'
import { type DemographicProfile } from '@/domain/selfie/selfieDemographics'
import { getPrompt } from '../prompt-composers/getPrompt'
import type { PreparedAsset } from '@/domain/style/elements/composition'
import {
  getStep1aCreativeLatitudeBase,
  getStep1aHardConstraints,
  getStep1aRoleTaskIntro,
  getStep1aTechnicalRequirements,
  projectStep1aPromptPayload,
} from './prompts/v3-step1a-prompt'

export interface V3Step1aArtifacts {
  mustFollowRules: string[]
  freedomRules: string[]
}

export interface V3Step1aInput {
  selfieReferences: ReferenceImage[]
  selfieComposite?: ReferenceImage
  faceComposite?: ReferenceImage
  bodyComposite?: ReferenceImage
  styleSettings: PhotoStyleSettings
  downloadAsset: DownloadAssetFn
  aspectRatio: string
  aspectRatioConfig: { id: string; width: number; height: number }
  expectedWidth: number
  expectedHeight: number
  canonicalPrompt: Record<string, unknown>
  step1aArtifacts: V3Step1aArtifacts
  generationId: string
  personId: string
  teamId?: string
  debugMode: boolean
  evaluationFeedback?: { suggestedAdjustments?: string }
  selfieAssetIds?: string[]
  demographics?: DemographicProfile
  onCostTracking?: CostTrackingHandler
  referenceImages?: BaseReferenceImage[]
  preparedAssets?: Map<string, PreparedAsset>
}

export interface V3Step1aOutput {
  imageBuffer: Buffer
  allImageBuffers: Buffer[]
  assetId?: string
  clothingLogoReference?: BaseReferenceImage
  backgroundLogoReference?: BaseReferenceImage
  selfieComposite?: BaseReferenceImage
  faceComposite?: BaseReferenceImage
  bodyComposite?: BaseReferenceImage
  reused?: boolean
  thinking?: string
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function normalizeRuleKey(rule: string): string {
  return rule
    .trim()
    .replace(/^[•\-*]\s*/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function dedupeRules(rules: string[]): string[] {
  const seen = new Set<string>()
  const deduped: string[] = []

  for (const rule of rules) {
    const key = normalizeRuleKey(rule)
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push(rule)
  }

  return deduped
}

function toPromptAccessoryLabel(accessoryKey: string): string {
  const map: Record<string, string> = {
    facialHair: 'facial hair',
    glasses: 'glasses',
    jewelry: 'jewelry',
    piercings: 'piercings',
    tattoos: 'tattoos',
  }
  return map[accessoryKey] || accessoryKey
}

function extractMandatoryAccessoryRemovals(projectedPrompt: Record<string, unknown>): string[] {
  const subject = asObject(projectedPrompt.subject)
  const beautification = asObject(subject?.beautification)
  const accessories = asObject(beautification?.accessories)
  if (!accessories) return []

  return Object.entries(accessories)
    .filter(([, value]) => asObject(value)?.action === 'remove')
    .map(([key]) => toPromptAccessoryLabel(key))
}

function extractAuthorizedInherentAccessories(projectedPrompt: Record<string, unknown>): string[] {
  const subject = asObject(projectedPrompt.subject)
  const subjectWardrobe = asObject(subject?.wardrobe)
  const topLevelWardrobe = asObject(projectedPrompt.wardrobe)
  const inherent = [
    ...asStringArray(subjectWardrobe?.inherent_accessories),
    ...asStringArray(topLevelWardrobe?.inherent_accessories),
  ]
  return [...new Set(inherent.map((item) => item.toLowerCase()))]
}

function shotCanRevealBelt(shotTypeId: string): boolean {
  return ['medium-shot', 'three-quarter', 'full-length', 'wide-shot'].includes(shotTypeId)
}

function removeConflictingAccessoryRules(
  rules: string[],
  mandatoryAccessoryRemovals: string[]
): { filtered: string[]; dropped: string[] } {
  if (mandatoryAccessoryRemovals.length === 0) {
    return { filtered: rules, dropped: [] }
  }

  const removalTargets = mandatoryAccessoryRemovals.map((value) => value.toLowerCase())
  const filtered: string[] = []
  const dropped: string[] = []

  for (const rule of rules) {
    const normalized = normalizeRuleKey(rule)
    const isPreserveAccessoriesGeneric = /preserve accessories shown in/i.test(normalized)

    const targetsFacialHair =
      removalTargets.includes('facial hair') &&
      /(facial hair|beard|mustache|moustache)/i.test(normalized)

    const isKeepOrPreserve = /\b(keep|preserve)\b/i.test(normalized)
    const isConflictingSpecific = isKeepOrPreserve && targetsFacialHair

    if (isPreserveAccessoriesGeneric || isConflictingSpecific) {
      dropped.push(rule)
      continue
    }

    filtered.push(rule)
  }

  return { filtered, dropped }
}

function promptHasWardrobeColorGuidance(projectedPrompt: Record<string, unknown>): boolean {
  const subject = asObject(projectedPrompt.subject)
  const subjectWardrobe = asObject(subject?.wardrobe)
  const topLevelWardrobe = asObject(projectedPrompt.wardrobe)
  const garmentAnalysis = asObject(topLevelWardrobe?.garmentAnalysis)
  const topLevelColors = asObject(topLevelWardrobe?.colors)

  const hasSubjectPalette = asStringArray(subjectWardrobe?.color_palette).length > 0
  const hasTopLevelPalette = asStringArray(topLevelWardrobe?.color_palette).length > 0
  const hasGarmentAnalysisPalette = asStringArray(garmentAnalysis?.colorPalette).length > 0
  const hasTopLevelColorFields = Boolean(
    topLevelColors &&
      Object.values(topLevelColors).some(
        (value) => typeof value === 'string' && value.trim().length > 0
      )
  )

  return (
    hasSubjectPalette ||
    hasTopLevelPalette ||
    hasGarmentAnalysisPalette ||
    hasTopLevelColorFields
  )
}

export function projectForStep1a(
  canonicalPrompt: Record<string, unknown>
): Record<string, unknown> {
  return projectStep1aPromptPayload(canonicalPrompt)
}

async function prepareAllReferences({
  selfieReferences,
  selfieComposite,
  styleSettings,
  generationId,
  preparedAssets,
}: {
  selfieReferences: ReferenceImage[]
  selfieComposite?: ReferenceImage
  styleSettings: PhotoStyleSettings
  generationId?: string
  preparedAssets?: Map<string, PreparedAsset>
}): Promise<{
  referenceImages: BaseReferenceImage[]
  logoReference?: BaseReferenceImage
  logoReferenceForEval?: BaseReferenceImage
  selfieComposite?: BaseReferenceImage
}> {
  if (selfieComposite) {
    Logger.debug('V3 Step 1a: Using provided selfie composite reference', {
      generationId,
      selfieCount: selfieReferences.length,
      selfieLabels: selfieReferences.map((ref) => ref.label || 'NO_LABEL'),
      compositeMimeType: selfieComposite.mimeType,
      compositeBase64Length: selfieComposite.base64.length,
    })
  }

  const hasClothingOverlay = preparedAssets?.has('clothing-overlay-overlay')

  let logoReference: BaseReferenceImage | undefined
  let logoReferenceForEval: BaseReferenceImage | undefined
  if (
    hasValue(styleSettings.branding) &&
    styleSettings.branding.value.type === 'include' &&
    styleSettings.branding.value.position === 'clothing'
  ) {
    const preparedLogo = preparedAssets?.get('branding-logo')
    if (preparedLogo?.data.base64) {
      const logoRef = {
        name: preparedLogo.data.s3Key || `branding-logo.${extensionFromMimeType(preparedLogo.data.mimeType, 'jpg')}`,
        description: getStep1aClothingLogoReferenceDescription(),
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png',
      }

      logoReferenceForEval = logoRef

      if (!hasClothingOverlay) {
        logoReference = logoRef
        Logger.debug('V3 Step 1a: Using prepared logo asset for clothing branding', {
          generationId,
          mimeType: preparedLogo.data.mimeType,
          s3Key: preparedLogo.data.s3Key,
        })
      } else {
        Logger.info(
          'V3 Step 1a: Logo reference loaded for eval only - clothing overlay handles generation',
          {
            generationId,
            overlayKey: 'clothing-overlay-overlay',
          }
        )
      }
    } else {
      Logger.warn('V3 Step 1a: Prepared logo asset not found, branding may not appear', {
        generationId,
        hasPreparedAssets: !!preparedAssets,
        preparedAssetKeys: Array.from(preparedAssets?.keys() || []),
      })
    }
  }

  const referenceImages: BaseReferenceImage[] = []
  if (selfieComposite) {
    referenceImages.push({
      ...selfieComposite,
      name:
        selfieComposite.name ||
        `selfie-composite.${extensionFromMimeType(selfieComposite.mimeType, 'jpg')}`,
    })
  }

  if (logoReference) {
    referenceImages.push(logoReference)
  }

  // Add clothing overlay as reference image when available
  if (hasClothingOverlay) {
    const overlayAsset = preparedAssets!.get('clothing-overlay-overlay')
    if (overlayAsset?.data.base64) {
      referenceImages.push({
        name:
          overlayAsset.data.s3Key ||
          `clothing-overlay.${extensionFromMimeType(overlayAsset.data.mimeType || 'image/png', 'jpg')}`,
        description: getClothingTemplateReferenceDescription(),
        base64: overlayAsset.data.base64,
        mimeType: overlayAsset.data.mimeType || 'image/png',
      })
      Logger.info('V3 Step 1a: Added clothing overlay as reference image', {
        generationId,
        mimeType: overlayAsset.data.mimeType,
        s3Key: overlayAsset.data.s3Key,
      })
    } else {
      Logger.warn('V3 Step 1a: Clothing overlay found in preparedAssets but missing base64 data', {
        generationId,
      })
    }
  }

  Logger.debug('V3 Step 1a: Prepared references for person generation (no format frame)', {
    generationId,
    totalReferences: referenceImages.length,
    hasLogo: !!logoReference,
    hasClothingOverlay: !!hasClothingOverlay,
  })

  return { referenceImages, logoReference, logoReferenceForEval, selfieComposite }
}

export async function executeV3Step1a(input: V3Step1aInput): Promise<V3Step1aOutput> {
  const {
    selfieReferences,
    selfieComposite,
    faceComposite,
    bodyComposite,
    styleSettings,
    aspectRatio,
    aspectRatioConfig,
    expectedWidth,
    expectedHeight,
    canonicalPrompt,
    step1aArtifacts,
    debugMode,
    evaluationFeedback,
    selfieAssetIds,
    personId,
    generationId,
    onCostTracking,
    preparedAssets,
  } = input

  Logger.debug('V3 Step 1a: Generating person on grey background')

  if (selfieAssetIds && selfieAssetIds.length > 0) {
    try {
      const styleParams = StyleFingerprintService.extractFromStyleSettings(styleSettings as Record<string, unknown>)
      const fingerprint = StyleFingerprintService.createPersonFingerprint(selfieAssetIds, {
        aspectRatio,
        expression: styleParams.expression,
        pose: styleParams.pose,
        shotType: styleParams.shotType,
        clothingType: styleParams.clothingType,
        clothingColor: styleParams.clothingColor,
        lighting: styleParams.lighting,
      })

      Logger.debug('V3 Step 1a: Created fingerprint for person-on-grey', {
        fingerprint,
        selfieAssetIds,
        generationId,
      })
    } catch (error) {
      Logger.warn('V3 Step 1a: Fingerprinting/reuse check failed, continuing with generation', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  const projectedPrompt = projectForStep1a(canonicalPrompt)
  const framing = asObject(projectedPrompt.framing)
  const shotDescription = (framing?.shot_type as string | undefined) || 'medium-shot'

  const shotTypeConfig = resolveShotType(shotDescription)
  const shotTypeIntroContext = getShotTypeIntroContext(shotTypeConfig)
  const bodyBoundaryInstruction = buildBodyBoundaryInstruction(shotTypeConfig)

  const { referenceImages: preparedReferences, logoReferenceForEval } = await prepareAllReferences({
    selfieReferences,
    selfieComposite,
    styleSettings,
    generationId,
    preparedAssets,
  })

  const filteredInputReferences = (input.referenceImages || []).filter((ref) => {
    const desc = ref.description?.toLowerCase() || ''
    return !desc.includes('composite image containing') && !desc.includes('stacked subject selfies')
  })

  const hasAnySplitComposite = !!faceComposite || !!bodyComposite
  const filteredPreparedReferences = hasAnySplitComposite
    ? preparedReferences.filter((ref) => {
        const desc = ref.description?.toLowerCase() || ''
        return !desc.includes('stacked subject selfies') && !desc.includes('composite image containing')
      })
    : preparedReferences

  const referenceImages = [...filteredInputReferences, ...filteredPreparedReferences]

  if (faceComposite) {
    referenceImages.push({
      ...faceComposite,
      name: faceComposite.name || `face-reference.${extensionFromMimeType(faceComposite.mimeType, 'jpg')}`,
    })
  }
  if (bodyComposite) {
    referenceImages.push({
      ...bodyComposite,
      name: bodyComposite.name || `body-reference.${extensionFromMimeType(bodyComposite.mimeType, 'jpg')}`,
    })
  }

  let garmentAnalysisFromStep0: Record<string, unknown> | undefined
  if (preparedAssets) {
    const collageAsset = preparedAssets.get('custom-clothing-garment-collage')
    const garmentDescription = collageAsset?.data?.metadata?.garmentDescription as
      | {
          items: unknown[]
          overallStyle: string
          colorPalette: string[]
          layering: string
          hasLogo: boolean
          logoDescription?: string
        }
      | undefined

    if (garmentDescription) {
      garmentAnalysisFromStep0 = {
        items: garmentDescription.items,
        overallStyle: garmentDescription.overallStyle,
        colorPalette: garmentDescription.colorPalette,
        layering: garmentDescription.layering,
        hasLogo: garmentDescription.hasLogo,
        logoDescription: garmentDescription.logoDescription,
      }
    }
  }

  if (garmentAnalysisFromStep0) {
    const wardrobe = asObject(projectedPrompt.wardrobe) || {}
    projectedPrompt.wardrobe = {
      ...wardrobe,
      garmentAnalysis: garmentAnalysisFromStep0,
    }
  }

  const jsonPrompt = JSON.stringify(projectedPrompt, null, 2)

  const hasClothingOverlay = preparedAssets?.has('clothing-overlay-overlay') ?? false
  const hasGarmentCollage = input.referenceImages?.some((ref) =>
    ref.description?.toUpperCase().includes('GARMENT COLLAGE')
  ) ?? false
  const hasClothingReference = hasClothingOverlay || hasGarmentCollage
  const hasWardrobeColorGuidance = promptHasWardrobeColorGuidance(projectedPrompt)

  const hardConstraints = getStep1aHardConstraints({
    bodyBoundaryInstruction: bodyBoundaryInstruction ?? undefined,
    shotDescription,
    hasClothingReference,
    hasWardrobeColorGuidance,
  })

  const allowAuthorizedLogosInStep1a = !!(
    hasValue(styleSettings.branding) &&
    styleSettings.branding.value.type === 'include' &&
    styleSettings.branding.value.position === 'clothing'
  )

  const technicalRequirements = getStep1aTechnicalRequirements({
    expectedWidth,
    expectedHeight,
    aspectRatioId: aspectRatioConfig.id,
    allowAuthorizedLogosInStep1a,
  })

  const inherentAccessories = extractAuthorizedInherentAccessories(projectedPrompt)
  if (inherentAccessories.includes('belt') && shotCanRevealBelt(shotTypeConfig.id)) {
    technicalRequirements.push(
      '- Belt visibility requirement: Because belt is an authorized inherent accessory for this waist-revealing framing, compose the subject so the waistband area is visible and the belt (strap and buckle) is clearly shown.'
    )
    technicalRequirements.push(
      '- Belt styling requirement: Belt color must be fashionable and clearly distinct from the trousers color.'
    )
  }

  const mandatoryAccessoryRemovals = extractMandatoryAccessoryRemovals(projectedPrompt)
  if (mandatoryAccessoryRemovals.length > 0) {
    technicalRequirements.push(
      '- Directive precedence: Explicit accessory REMOVE actions in subject.beautification.accessories override general identity/accessory preservation guidance for those specific accessories.'
    )
    technicalRequirements.push(
      `- Mandatory removals for this generation: ${mandatoryAccessoryRemovals.join(', ')}. These must be absent in the output even if visible in selfie references.`
    )
  }

  const mustFollowWithoutConflicts = removeConflictingAccessoryRules(
    step1aArtifacts.mustFollowRules,
    mandatoryAccessoryRemovals
  )

  if (mustFollowWithoutConflicts.dropped.length > 0) {
    Logger.info('V3 Step 1a: Dropped conflicting must-follow rules due to explicit accessory removals', {
      generationId,
      droppedRules: mustFollowWithoutConflicts.dropped,
      mandatoryAccessoryRemovals,
    })
  }

  for (const rule of mustFollowWithoutConflicts.filtered) {
    technicalRequirements.push(`- ${rule}`)
  }

  const technicalRequirementsDeduped = dedupeRules(technicalRequirements)
  const technicalRequirementKeys = new Set(
    technicalRequirementsDeduped.map((rule) => normalizeRuleKey(rule))
  )

  const creativeLatitudeRaw = [
    ...getStep1aCreativeLatitudeBase(),
    ...step1aArtifacts.freedomRules.map((rule) => `- ${rule}`),
  ]
  const creativeLatitude = dedupeRules(
    creativeLatitudeRaw.filter((rule) => !technicalRequirementKeys.has(normalizeRuleKey(rule)))
  )

  const compositionPrompt = getPrompt([
    {
      lines: [
        getStep1aRoleTaskIntro(shotTypeIntroContext),
      ],
    },
    { lines: hardConstraints },
    {
      jsonTitle: 'Scene Specifications:',
      json: jsonPrompt,
    },
    {
      title: 'Technical Requirements:',
      lines: technicalRequirementsDeduped,
    },
    {
      title: 'Creative Latitude:',
      lines: creativeLatitude,
    },
    evaluationFeedback?.suggestedAdjustments
      ? {
          title: 'ADJUSTMENTS FROM PREVIOUS ATTEMPT:',
          lines: [evaluationFeedback.suggestedAdjustments],
        }
      : null,
  ])

  logPrompt('V3 Step 1a', compositionPrompt, generationId)

  Logger.info('V3 Step 1a: References', {
    count: referenceImages.length,
    types: referenceImages.map((img) => img.description?.split(' ')[0] || 'unknown').join(', '),
    names: referenceImages.map((img) => img.name || 'unnamed'),
  })

  const step1aResolution = STAGE_RESOLUTION.STEP_1A_PERSON || '1K'
  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>

  try {
    generationResult = await generateWithGemini(compositionPrompt, referenceImages, aspectRatio, step1aResolution, {
      temperature: AI_CONFIG.PERSON_GENERATION_TEMPERATURE,
      stage: 'STEP_1A_PERSON',
    })
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
    throw new Error('V3 Step 1a: Gemini returned no images')
  }

  const allImageBuffers = generationResult.images
  const imageBuffer = allImageBuffers[0]

  logStepResult('V3 Step 1a', {
    success: true,
    provider: generationResult.providerUsed,
    model: STAGE_MODEL.STEP_1A_PERSON,
    imageSize: imageBuffer.length,
    durationMs: generationResult.usage.durationMs,
    imagesReturned: allImageBuffers.length,
  })

  if (onCostTracking) {
    try {
      await onCostTracking({
        stepName: 'step1a-person',
        reason: 'generation',
        result: 'success',
        model: STAGE_MODEL.STEP_1A_PERSON,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
    } catch (error) {
      Logger.error('V3 Step 1a: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  let backgroundLogoReference: BaseReferenceImage | undefined
  const preparedBackgroundAsset = preparedAssets?.get('background-custom-background')
  const preparedBackgroundMetadata = preparedBackgroundAsset?.data.metadata as
    | Record<string, unknown>
    | undefined
  const isBackgroundPreBranded = preparedBackgroundMetadata?.preBrandedWithLogo === true
  const shouldBuildBackgroundLogoReferenceForEval =
    hasValue(styleSettings.branding) &&
    styleSettings.branding.value.type === 'include' &&
    (styleSettings.branding.value.position === 'background' ||
      styleSettings.branding.value.position === 'elements') &&
    !isBackgroundPreBranded

  if (
    shouldBuildBackgroundLogoReferenceForEval &&
    hasValue(styleSettings.branding) &&
    (styleSettings.branding.value.position === 'background' ||
      styleSettings.branding.value.position === 'elements')
  ) {
    const preparedLogo = preparedAssets?.get('branding-logo')
    if (preparedLogo?.data.base64) {
      backgroundLogoReference = {
        name: preparedLogo.data.s3Key || `branding-logo.${extensionFromMimeType(preparedLogo.data.mimeType, 'jpg')}`,
        description: getStep1aBackgroundLogoReferenceDescription(styleSettings.branding.value.position),
        base64: preparedLogo.data.base64,
        mimeType: preparedLogo.data.mimeType || 'image/png',
      }
    }
  }

  return {
    imageBuffer,
    allImageBuffers,
    clothingLogoReference: logoReferenceForEval,
    backgroundLogoReference,
    selfieComposite,
    faceComposite,
    bodyComposite,
    reused: false,
    thinking: generationResult.thinking,
  }
}
