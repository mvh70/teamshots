import { freepackage as freepackageBase } from './index'
import { buildDefaultReferencePayload } from '@/lib/generation/reference-utils'
import { resolveAspectRatio } from '../../elements/aspect-ratio/config'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { Logger } from '@/lib/logger'
import { ensureServerDefaults, mergeUserSettings } from '../shared/utils'
import type { AspectRatioId } from '../../elements/aspect-ratio/config'
import type { GenerationContext, GenerationPayload } from '@/types/generation'

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
    // Apply correct priority hierarchy:
    // 1. Preset defaults (base layer - CORPORATE_HEADSHOT)
    // 2. Package defaults (middle layer - overwrites ALL categories from preset)
    // 3. User settings (top layer - overwrites only visible categories)
    
    // 1. Start with preset defaults (base configuration)
    const { settings: presetDefaults } = applyStandardPreset(
      styleSettings.presetId || freepackageBase.defaultPresetId,
      {},  // Empty - get pure preset defaults
      freepackageBase.presets || {}
    )

    // 2. Apply package defaults for ALL categories (package baseline)
    const withPackageDefaults = ensureServerDefaults(freepackageBase, presetDefaults)

    // 3. Apply user settings ONLY for visible categories (user customizations)
    const effectiveSettings = mergeUserSettings(
      withPackageDefaults,
      styleSettings,
      freepackageBase.visibleCategories
    )

    // Fixed to medium-shot for freepackage (package standard, already applied above)
    effectiveSettings.shotType = { type: 'medium-shot' }
    const shotTypeConfig = resolveShotType('medium-shot')
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
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      skipLogoInComposite: options.skipLogoInComposite ?? false
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

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


