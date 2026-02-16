import { Logger } from '@/lib/logger'
import sharp from 'sharp'

import { resolveAspectRatioConfig } from '@/domain/style/elements/aspect-ratio/config'
import { BACKGROUND_ENVIRONMENT_MAP } from '@/domain/style/elements/background/config'
import { hasValue } from '@/domain/style/elements/base/element-types'
import {
  getStep2BackgroundColorHardConstraints,
  getStep2BackgroundCompositingInstructions,
  getStep2BackgroundHardConstraints,
  getStep2BackgroundReferenceDescription,
  type Step2BackgroundMode,
} from '@/domain/style/elements/background/prompt'
import { resolveShotType } from '@/domain/style/elements/shot-type/config'
import { getStep2ShotTypeFramingConstraint } from '@/domain/style/elements/shot-type/prompt'
import type { PreparedAsset } from '@/domain/style/elements/composition'
import type { Step7Output, ReferenceImage as BaseReferenceImage } from '@/types/generation'
import type { PhotoStyleSettings } from '@/types/photo-style'

import { AI_CONFIG, PROMINENCE, STAGE_MODEL } from '../config'
import { generateWithGemini } from '../gemini'
import { getPrompt } from '../prompt-composers/getPrompt'
import { logPrompt, logStepResult } from '../utils/logging'
import { deepMergePromptObjects } from '../utils/prompt-merge'
import { buildAspectRatioFormatReference } from '../utils/reference-builder'
import type { CostTrackingHandler } from '../workflow-v3'
import {
  getStep2BaseImageReferenceDescription,
  getStep2BodyReferenceDescription,
  getStep2FaceReferenceDescription,
  getStep2Intro,
  getStep2PersonProminenceInstructions,
  getStep2QualityGuidelines,
  getStep2RealismAndNegativeGuidelines,
} from './prompts/v3-step2-prompt'

export interface V3Step2Artifacts {
  mustFollowRules: string[]
  freedomRules: string[]
  payloadOverlay?: Record<string, unknown>
}

export interface V3Step2FinalInput {
  personBuffer: Buffer
  personMimeType?: string
  backgroundBuffer?: Buffer
  backgroundMimeType?: string
  styleSettings?: PhotoStyleSettings
  faceCompositeReference?: BaseReferenceImage
  bodyCompositeReference?: BaseReferenceImage
  evaluatorComments?: string[]
  aspectRatio: string
  resolution?: '1K' | '2K' | '4K'
  canonicalPrompt: Record<string, unknown>
  step2Artifacts: V3Step2Artifacts
  generationId?: string
  onCostTracking?: CostTrackingHandler
  preparedAssets?: Map<string, PreparedAsset>
}

export type Step2Mode = Step2BackgroundMode

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function extensionFromMimeType(mimeType?: string): string {
  const normalized = (mimeType || '').toLowerCase()
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  return 'jpg'
}

function getBackgroundType(styleSettings?: PhotoStyleSettings): string | undefined {
  if (!styleSettings?.background || !hasValue(styleSettings.background)) {
    return undefined
  }
  return styleSettings.background.value.type
}

function getBackgroundColor(styleSettings?: PhotoStyleSettings): string | undefined {
  if (!styleSettings?.background || !hasValue(styleSettings.background)) {
    return undefined
  }
  const color = styleSettings.background.value.color
  return typeof color === 'string' ? color : undefined
}

function getBrandingValue(styleSettings?: PhotoStyleSettings):
  | { type: string; position?: string }
  | undefined {
  if (!styleSettings?.branding || !hasValue(styleSettings.branding)) {
    return undefined
  }
  return styleSettings.branding.value as { type: string; position?: string }
}

function resolveStep2Mode(styleSettings: PhotoStyleSettings | undefined, backgroundBuffer?: Buffer): Step2Mode {
  if (backgroundBuffer) {
    return 'immutable'
  }

  const backgroundType = getBackgroundType(styleSettings)
  const brandingValue = getBrandingValue(styleSettings)

  if (backgroundType === 'custom') {
    throw new Error('V3 Step 2: custom background requires Step 0 background buffer, but none was provided')
  }

  const hasBackgroundOrElementsBranding =
    brandingValue?.type === 'include' &&
    (brandingValue.position === 'background' || brandingValue.position === 'elements')
  if (hasBackgroundOrElementsBranding) {
    throw new Error(
      `V3 Step 2: branding on ${brandingValue.position} requires Step 0 pre-branded background buffer, but none was provided`
    )
  }

  if (backgroundType && BACKGROUND_ENVIRONMENT_MAP[backgroundType] === 'studio') {
    return 'studio'
  }

  return 'environmental'
}

export function projectForStep2(
  canonicalPrompt: Record<string, unknown>,
  payloadOverlay?: Record<string, unknown>
): {
  step2Prompt: Record<string, unknown>
} {
  const step2Prompt: Record<string, unknown> = {}

  const scene = asObject(canonicalPrompt.scene)
  if (scene) step2Prompt.scene = scene

  const camera = asObject(canonicalPrompt.camera)
  if (camera) step2Prompt.camera = camera

  const lighting = asObject(canonicalPrompt.lighting)
  if (lighting) step2Prompt.lighting = lighting

  const rendering = asObject(canonicalPrompt.rendering)
  if (rendering) step2Prompt.rendering = rendering

  const framing = asObject(canonicalPrompt.framing)
  if (framing) step2Prompt.framing = framing

  const technicalDetails = asObject(canonicalPrompt.technical_details)
  if (technicalDetails) step2Prompt.technical_details = technicalDetails

  const { merged } = deepMergePromptObjects(step2Prompt, payloadOverlay)

  return { step2Prompt: merged }
}

export async function executeV3Step2(input: V3Step2FinalInput): Promise<Step7Output> {
  const {
    personBuffer,
    personMimeType,
    backgroundBuffer,
    backgroundMimeType,
    styleSettings,
    faceCompositeReference,
    bodyCompositeReference,
    evaluatorComments,
    aspectRatio,
    resolution,
    canonicalPrompt,
    step2Artifacts,
    generationId,
    onCostTracking,
    preparedAssets,
  } = input

  const aspectRatioConfig = resolveAspectRatioConfig(aspectRatio)
  const resolutionMultiplier = resolution === '4K' ? 4 : resolution === '2K' ? 2 : 1
  const expectedWidth = aspectRatioConfig.width * resolutionMultiplier
  const expectedHeight = aspectRatioConfig.height * resolutionMultiplier

  const { step2Prompt } = projectForStep2(canonicalPrompt, step2Artifacts.payloadOverlay)

  const mode = resolveStep2Mode(styleSettings, backgroundBuffer)
  const framing = asObject(step2Prompt.framing)
  const shotTypeId = (framing?.shot_type as string | undefined) || 'medium-shot'
  const shotTypeConfig = resolveShotType(shotTypeId)
  const shotType = shotTypeConfig.id.replace(/-/g, ' ')
  const shotDescription = (framing?.crop_points as string | undefined) || shotTypeConfig.framingDescription

  const backgroundType = getBackgroundType(styleSettings)
  const backgroundColor = getBackgroundColor(styleSettings)
  const brandingValue = getBrandingValue(styleSettings)
  const hasBackgroundOrElementsBranding =
    brandingValue?.type === 'include' &&
    (brandingValue.position === 'background' || brandingValue.position === 'elements')

  const preparedBackgroundAsset = preparedAssets?.get('background-custom-background')
  const preparedBackgroundMetadata = preparedBackgroundAsset?.data.metadata as Record<string, unknown> | undefined
  const preBrandedWithLogo = preparedBackgroundMetadata?.preBrandedWithLogo === true

  if (hasBackgroundOrElementsBranding && !preBrandedWithLogo) {
    throw new Error(
      `V3 Step 2: branding on ${brandingValue?.position} requires Step 0 pre-branded background metadata, but preBrandedWithLogo is not true`
    )
  }

  if (mode === 'immutable' && 'scene' in step2Prompt) {
    delete step2Prompt.scene
  }

  const effectiveMustFollowRules = step2Artifacts.mustFollowRules || []
  const effectiveFreedomRules = step2Artifacts.freedomRules || []

  const cameraPositioning = asObject(asObject(step2Prompt.camera)?.positioning)
  const subjectToBackgroundFt =
    typeof cameraPositioning?.subject_to_background_ft === 'number'
      ? cameraPositioning.subject_to_background_ft
      : 8

  const jsonPrompt = JSON.stringify(step2Prompt, null, 2)

  const intro = getStep2Intro(mode)
  const sceneEnvironment = asObject(asObject(step2Prompt.scene)?.environment)
  const colorPalette = Array.isArray(sceneEnvironment?.color_palette)
    ? sceneEnvironment?.color_palette
    : []
  const primaryBackgroundColor =
    colorPalette.length > 0 && typeof colorPalette[0] === 'string'
      ? colorPalette[0]
      : backgroundColor

  const hardConstraints: string[] = [
    '**HARD CONSTRAINTS (Non-Negotiable):**',
    getStep2ShotTypeFramingConstraint({ shotType, shotDescription }),
    ...getStep2BackgroundHardConstraints(mode),
    ...getStep2BackgroundColorHardConstraints({
      mode,
      backgroundType,
      primaryBackgroundColor,
    }),
  ]

  const compositingInstructions = getStep2BackgroundCompositingInstructions({
    mode,
    subjectToBackgroundFt,
  })

  const prominenceInstructions = getStep2PersonProminenceInstructions(PROMINENCE.label)
  const realismAndNegativeGuidelines = getStep2RealismAndNegativeGuidelines()

  const compositionPrompt = getPrompt([
    { lines: [...intro, '', ...hardConstraints] },
    {
      jsonTitle: 'Scene, Camera, Lighting & Rendering Specifications:',
      json: jsonPrompt,
    },
    {
      lines: [...compositingInstructions, '', ...prominenceInstructions],
    },
    effectiveMustFollowRules.length > 0
      ? {
          title: '**Element Constraints:**',
          lines: effectiveMustFollowRules.map((rule) => `- ${rule}`),
        }
      : null,
    effectiveFreedomRules.length > 0
      ? {
          title: '**Creative Latitude:**',
          lines: effectiveFreedomRules.map((freedom) => `- ${freedom}`),
        }
      : null,
    evaluatorComments && evaluatorComments.length > 0
      ? {
          title: 'Refinement Instructions (from previous evaluations):',
          lines: evaluatorComments.map((comment) => `- ${comment}`),
        }
      : null,
    {
      title: 'Quality Guidelines:',
      lines: getStep2QualityGuidelines(realismAndNegativeGuidelines),
    },
  ])

  const formatFrame = await buildAspectRatioFormatReference({
    width: expectedWidth,
    height: expectedHeight,
    aspectRatioDescription: aspectRatio,
  })

  const referenceImages: BaseReferenceImage[] = [
    {
      name: `step1a-person.${extensionFromMimeType(personMimeType || 'image/jpeg')}`,
      description: getStep2BaseImageReferenceDescription(),
      base64: personBuffer.toString('base64'),
      mimeType: personMimeType || 'image/jpeg',
    },
  ]

  if (mode === 'immutable' && backgroundBuffer) {
    referenceImages.push({
      name:
        preparedBackgroundAsset?.data.s3Key ||
        `step0-background.${extensionFromMimeType(backgroundMimeType || 'image/jpeg')}`,
      description: getStep2BackgroundReferenceDescription(),
      base64: backgroundBuffer.toString('base64'),
      mimeType: backgroundMimeType || 'image/jpeg',
    })
  }

  referenceImages.push({
    ...formatFrame,
    name: `format-frame-${aspectRatio}.png`,
  })

  if (faceCompositeReference) {
    referenceImages.push({
      name:
        faceCompositeReference.name ||
        `face-reference.${extensionFromMimeType(faceCompositeReference.mimeType)}`,
      description: getStep2FaceReferenceDescription(),
      base64: faceCompositeReference.base64,
      mimeType: faceCompositeReference.mimeType,
    })
  }

  if (bodyCompositeReference) {
    referenceImages.push({
      name:
        bodyCompositeReference.name ||
        `body-reference.${extensionFromMimeType(bodyCompositeReference.mimeType)}`,
      description: getStep2BodyReferenceDescription(),
      base64: bodyCompositeReference.base64,
      mimeType: bodyCompositeReference.mimeType,
    })
  }

  Logger.info('V3 Step 2: References', {
    count: referenceImages.length,
    mode,
    backgroundType,
    types: referenceImages.map((img) => img.description?.split(' ')[0] || 'unknown').join(', '),
    names: referenceImages.map((img) => img.name || 'unnamed'),
  })

  let generationResult: Awaited<ReturnType<typeof generateWithGemini>>

  try {
    logPrompt('V3 Step 2', compositionPrompt, generationId)
    generationResult = await generateWithGemini(compositionPrompt, referenceImages, aspectRatio, resolution, {
      temperature: AI_CONFIG.REFINEMENT_TEMPERATURE,
      stage: 'STEP_2_COMPOSITION',
    })
  } catch (error) {
    const providerUsed = (error as { providerUsed?: 'vertex' | 'gemini-rest' | 'replicate' }).providerUsed
    if (onCostTracking) {
      try {
        await onCostTracking({
          stepName: 'step2-composition',
          reason: 'generation',
          result: 'failure',
          model: STAGE_MODEL.STEP_2_COMPOSITION,
          provider: providerUsed,
          errorMessage: error instanceof Error ? error.message : String(error),
        })
      } catch (costError) {
        Logger.error('V3 Step 2: Failed to track generation cost (failure case)', {
          error: costError instanceof Error ? costError.message : String(costError),
          generationId,
        })
      }
    }
    throw error
  }

  if (!generationResult.images.length) {
    throw new Error('V3 Step 2: Gemini returned no images')
  }

  const allImageBuffers = generationResult.images

  let selectedBuffer = allImageBuffers[0]
  if (allImageBuffers.length > 1) {
    const bufferMetadata = await Promise.all(
      allImageBuffers.map(async (buf, idx) => {
        const meta = await sharp(buf).metadata()
        return { idx, buf, width: meta.width || 0, height: meta.height || 0 }
      })
    )

    const correctDimImage = bufferMetadata.find(
      (m) => m.width === expectedWidth && m.height === expectedHeight
    )

    if (correctDimImage) {
      selectedBuffer = correctDimImage.buf
    } else {
      const largest = bufferMetadata.reduce((a, b) => (a.width * a.height > b.width * b.height ? a : b))
      selectedBuffer = largest.buf
    }
  }

  logStepResult('V3 Step 2', {
    success: true,
    provider: generationResult.providerUsed,
    model: STAGE_MODEL.STEP_2_COMPOSITION,
    imageSize: selectedBuffer.length,
    durationMs: generationResult.usage.durationMs,
    imagesReturned: allImageBuffers.length,
  })

  if (onCostTracking) {
    try {
      await onCostTracking({
        stepName: 'step2-composition',
        reason: 'generation',
        result: 'success',
        model: STAGE_MODEL.STEP_2_COMPOSITION,
        provider: generationResult.providerUsed,
        inputTokens: generationResult.usage.inputTokens,
        outputTokens: generationResult.usage.outputTokens,
        imagesGenerated: generationResult.usage.imagesGenerated,
        durationMs: generationResult.usage.durationMs,
      })
    } catch (error) {
      Logger.error('V3 Step 2: Failed to track generation cost', {
        error: error instanceof Error ? error.message : String(error),
        generationId,
      })
    }
  }

  return {
    refinedBuffer: selectedBuffer,
    allImageBuffers,
    thinking: generationResult.thinking,
  }
}
