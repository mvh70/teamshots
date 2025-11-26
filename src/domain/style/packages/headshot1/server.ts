import { headshot1 as headshot1Base } from './index'
import { buildDefaultReferencePayload } from '@/lib/generation/reference-utils'
import { resolveAspectRatio } from '../../elements/aspect-ratio/config'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { Logger } from '@/lib/logger'
import { ensureServerDefaults, mergeUserSettings } from '../shared/utils'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import { buildStandardPrompt } from '../../prompt-builders/context'
import * as shotTypeElement from '../../elements/shot-type'
import * as cameraSettings from '../../elements/camera-settings'
import * as lighting from '../../elements/lighting'
import * as pose from '../../elements/pose'
import * as backgroundElement from '../../elements/background'
import * as clothing from '../../elements/clothing'
import * as subjectElement from '../../elements/subject'
import * as branding from '../../elements/branding'
import type { AspectRatioId } from '../../elements/aspect-ratio/config'
import type { GenerationContext, GenerationPayload } from '@/types/generation'

export type Headshot1ServerPackage = typeof headshot1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const headshot1Server: Headshot1ServerPackage = {
  ...headshot1Base,
  buildGenerationPayload: async ({
    generationId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
    // Apply correct priority hierarchy:
    // 1. Preset defaults (base layer - CORPORATE_HEADSHOT)
    // 2. Package defaults (middle layer - overwrites ALL categories from preset)
    // 3. User settings (top layer - overwrites only visible categories)
    
    // 1. Start with preset defaults (base configuration)
    const { settings: presetDefaults } = applyStandardPreset(
      styleSettings.presetId || headshot1Base.defaultPresetId,
      {},  // Empty - get pure preset defaults
      headshot1Base.presets || {}
    )

    // 2. Apply package defaults for ALL categories (package baseline)
    const withPackageDefaults = ensureServerDefaults(headshot1Base, presetDefaults)

    // 3. Apply user settings ONLY for visible categories (user customizations)
    const effectiveSettings = mergeUserSettings(
      withPackageDefaults,
      styleSettings,
      headshot1Base.visibleCategories
    )

    // Fixed to medium-shot for headshot1 (package standard)
    effectiveSettings.shotType = { type: 'medium-shot' }
    const shotTypeConfig = resolveShotType('medium-shot')
    const shotText = shotTypeConfig.label

    const explicitAspectRatio = (effectiveSettings.aspectRatio as AspectRatioId | undefined) || undefined
    const canonicalRatioConfig = resolveAspectRatio(shotTypeConfig.id)
    let ratioConfig = canonicalRatioConfig

    if (explicitAspectRatio && explicitAspectRatio !== canonicalRatioConfig.id) {
      Logger.debug('Aspect ratio mismatch detected. Using canonical value derived from shot type.', {
        packageId: headshot1Base.id,
        shotType: shotTypeConfig.id,
        canonicalAspectRatio: canonicalRatioConfig.id,
        explicitAspectRatio
      })
    }

    if (explicitAspectRatio && explicitAspectRatio === canonicalRatioConfig.id) {
      ratioConfig = resolveAspectRatio(shotTypeConfig.id, explicitAspectRatio)
    }

    effectiveSettings.aspectRatio = ratioConfig.id
    const aspectRatio = ratioConfig.id
    const aspectRatioDescription = `${ratioConfig.id} (${ratioConfig.width}x${ratioConfig.height})`

    const getSelfieBuffer = async (key: string): Promise<Buffer> => {
      const buffer = processedSelfies[key]
      if (!buffer) {
        throw new Error(`Selfie buffer not found for key: ${key}. All selfies should be preprocessed before calling buildGenerationPayload.`)
      }
      return buffer
    }

    const shouldUseComposite: boolean =
      options.workflowVersion === 'v3' ||
      (options.useCompositeReference &&
        (styleSettings.background?.type === 'custom' ||
          (styleSettings.branding?.type !== 'exclude' && Boolean(styleSettings.branding?.logoKey))))

    const bucketName = getS3BucketName()
    const s3Client = createS3Client({ forcePathStyle: false })
    
    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client, key }),
      useCompositeReference: shouldUseComposite,
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      workflowVersion: options.workflowVersion
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    // Build context to get rules (same logic as buildPrompt but we need the context)
    const context = buildStandardPrompt({
      settings: effectiveSettings,
      defaultPresetId: headshot1Base.defaultPresetId,
      presets: headshot1Base.presets || {}
    })

    // Apply elements in dependency order (same as buildPrompt)
    shotTypeElement.applyToPayload(context)
    cameraSettings.applyToPayload(context)
    lighting.applyToPayload(context)
    pose.applyToPayload(context)
    backgroundElement.applyToPayload(context)
    clothing.applyToPayload(context)
    subjectElement.applyToPayload(context)
    branding.applyToPayload(context)

    const promptString = JSON.stringify(context.payload, null, 2)

    return {
      prompt: promptString,
      mustFollowRules: context.mustFollowRules,
      freedomRules: context.freedomRules,
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription
    }
  }
}


