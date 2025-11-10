import { headshot1 as headshot1Base } from './index'
import { resolveAspectRatio } from '../aspect-ratios'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../camera-presets'
import type { AspectRatioId } from '../aspect-ratios'
import { buildDefaultReferencePayload } from '@/lib/generation/reference-utils'
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

    const ratioConfig = resolveAspectRatio(
      shotTypeConfig.id,
      (effectiveSettings.aspectRatio as AspectRatioId | undefined) || undefined
    )
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

    const { referenceImages, labelInstruction } = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: assets.downloadAsset,
      useCompositeReference: options.useCompositeReference,
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height }
    })

    const promptResult = headshot1Base.promptBuilder(effectiveSettings, { generationId })
    const promptString =
      typeof promptResult === 'string' ? promptResult : JSON.stringify(promptResult)

    return {
      prompt: promptString,
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription
    }
  }
}

