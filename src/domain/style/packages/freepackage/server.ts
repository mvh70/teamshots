import { freepackage as freepackageBase } from './index'
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

export type FreePackageServerPackage = typeof freepackageBase & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const freepackageServer: FreePackageServerPackage = {
  ...freepackageBase,
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
      styleSettings.presetId || freepackageBase.defaultPresetId,
      styleSettings
    )

    const shotTypeConfig = resolveShotType(effectiveSettings.shotType?.type)
    const shotText = shotTypeConfig.label

    const explicitAspectRatio = (effectiveSettings.aspectRatio as AspectRatioId | undefined) || undefined
    const canonicalRatioConfig = resolveAspectRatio(shotTypeConfig.id)
    let ratioConfig = canonicalRatioConfig

    if (explicitAspectRatio && explicitAspectRatio !== canonicalRatioConfig.id) {
      Logger.debug('Aspect ratio mismatch detected. Using canonical value derived from shot type.', {
        packageId: freepackageBase.id,
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

    let referenceImages: ReferenceImage[] = []
    let labelInstruction = ''

    if (
      styleSettings.background?.type === 'custom' ||
      (styleSettings.branding?.type !== 'exclude' && styleSettings.branding?.logoKey)
    ) {
      const payload = await buildDefaultReferencePayload({
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
      referenceImages = payload.referenceImages
      labelInstruction = payload.labelInstruction
    } else {
      referenceImages = await buildCollectiveReferenceImages(
        effectiveSettings,
        selfieKeys,
        getSelfieBuffer,
        assets.downloadAsset
      )

      const selfieLabels = selfieKeys.map((_, index) => `SUBJECT1-SELFIE${index + 1}`)
      let instruction =
        'Reference selfies are provided individually. Each image is preceded by a text label so you can identify it:\n'
      for (const label of selfieLabels) {
        instruction += `- **${label}:** Selfie of the subject (same person) from a different angle.\n`
      }
      instruction += "\nUse 'SUBJECT1-SELFIE1' as the primary identity reference; the other selfies provide supporting angles."
      instruction += `\n**CRITICAL ORIENTATION REQUIREMENT:** The final output image MUST be vertical (portrait orientation) with height significantly greater than width. Respect the requested shot type (${shotText}) and aspect ratio (${aspectRatioDescription}).`
      labelInstruction = instruction
    }

    const promptResult = freepackageBase.promptBuilder(effectiveSettings, { generationId })
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

