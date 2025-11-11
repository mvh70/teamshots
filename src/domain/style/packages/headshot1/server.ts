import { headshot1 as headshot1Base } from './index'
import {
  buildCollectiveReferenceImages,
  buildDefaultReferencePayload
} from '@/lib/generation/reference-utils'
import { resolveAspectRatio } from '../aspect-ratios'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../camera-presets'
import { Logger } from '@/lib/logger'
import type { AspectRatioId } from '../aspect-ratios'
import type { GenerationContext, GenerationPayload, ReferenceImage } from '@/types/generation'

export type Headshot1ServerPackage = typeof headshot1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const headshot1Server: Headshot1ServerPackage = {
  ...headshot1Base,
  buildGenerationPayload: async ({
    generationId,
    styleSettings,
    selfieKeys,
    primarySelfieKey,
    processedSelfies,
    assets,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
    const { settings: effectiveSettings } = applyStandardPreset(
      styleSettings.presetId || headshot1Base.defaultPresetId,
      styleSettings
    )

    const shotTypeConfig = resolveShotType(effectiveSettings.shotType?.type)
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
      if (processedSelfies[key]) {
        return processedSelfies[key]
      }
      const buffer = await assets.preprocessSelfie(key)
      processedSelfies[key] = buffer
      return buffer
    }

    if (!processedSelfies[primarySelfieKey]) {
      processedSelfies[primarySelfieKey] = await assets.preprocessSelfie(primarySelfieKey)
    }

    const shouldUseComposite: boolean =
      options.useCompositeReference &&
      (styleSettings.background?.type === 'custom' ||
        (styleSettings.branding?.type !== 'exclude' && Boolean(styleSettings.branding?.logoKey)))

    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: assets.downloadAsset,
      useCompositeReference: shouldUseComposite,
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height }
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    const promptResult = headshot1Base.promptBuilder(effectiveSettings, { generationId })
    const promptString =
      typeof promptResult === 'string' ? promptResult : JSON.stringify(promptResult, null, 2)

    return {
      prompt: promptString,
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription
    }
  }
}

