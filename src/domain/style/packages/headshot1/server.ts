import { headshot1 as headshot1Base } from './index'
import { buildDefaultReferencePayload, buildSplitSelfieComposites } from '@/lib/generation/reference-utils'
import { applyStandardPreset } from '../standard-settings'
import { resolveShotType } from '../../elements/shot-type/config'
import { ensureServerDefaults, mergeUserSettings } from '../shared/utils'
import { resolvePackageAspectRatio } from '../shared/aspect-ratio-resolver'
import { downloadAssetAsBase64 } from '@/queue/workers/generate-image/s3-utils'
import { getS3BucketName, createS3Client } from '@/lib/s3-client'
import { compositionRegistry } from '../../elements/composition'
import { Telemetry } from '@/lib/telemetry'
import { hasValue, predefined } from '../../elements/base/element-types'
import type { GenerationContext, GenerationPayload, ReferenceImage } from '@/types/generation'
import { Logger } from '@/lib/logger'

export type Headshot1ServerPackage = typeof headshot1Base & {
  buildGenerationPayload: (context: GenerationContext) => Promise<GenerationPayload>
}

export const headshot1Server: Headshot1ServerPackage = {
  ...headshot1Base,
  buildGenerationPayload: async ({
    generationId,
    personId,
    styleSettings,
    selfieKeys,
    processedSelfies,
    selfieTypeMap,
    options
  }: GenerationContext): Promise<GenerationPayload> => {
    // Track package usage
    Telemetry.increment(`generation.package.${headshot1Base.id}`)
    Telemetry.increment(`generation.package.${headshot1Base.id}.workflow.${options.workflowVersion}`)

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

    // Use package default shotType (respects package configuration)
    const defaultShotType = headshot1Base.defaultSettings.shotType
    const packageShotType = hasValue(defaultShotType) ? defaultShotType.value.type : 'medium-shot'
    effectiveSettings.shotType = predefined({ type: packageShotType })
    const shotTypeConfig = resolveShotType(packageShotType)
    const shotText = shotTypeConfig.id.replace(/-/g, ' ')

    // Resolve aspect ratio using shared logic
    const { ratioConfig, aspectRatio, aspectRatioDescription } = resolvePackageAspectRatio(
      effectiveSettings,
      shotTypeConfig,
      headshot1Base.id
    )

    const getSelfieBuffer = async (key: string): Promise<Buffer> => {
      const buffer = processedSelfies[key]
      if (!buffer) {
        throw new Error(`Selfie buffer not found for key: ${key}. All selfies should be preprocessed before calling buildGenerationPayload.`)
      }
      return buffer
    }

    // V3 workflow always uses composite reference
    const bucketName = getS3BucketName()
    const s3Client = createS3Client({ forcePathStyle: false })

    // Build split composites if selfieTypeMap is available
    let faceComposite: ReferenceImage | undefined
    let bodyComposite: ReferenceImage | undefined
    let selfieComposite: ReferenceImage | undefined

    if (selfieTypeMap && Object.keys(selfieTypeMap).length > 0) {
      Logger.info('Building split selfie composites (face/body)', {
        generationId,
        selfieTypeMap,
        selfieCount: selfieKeys.length
      })

      const splitComposites = await buildSplitSelfieComposites({
        selfieKeys,
        selfieTypeMap,
        getSelfieBuffer,
        generationId
      })

      faceComposite = splitComposites.faceComposite ?? undefined
      bodyComposite = splitComposites.bodyComposite ?? undefined
      selfieComposite = splitComposites.combinedComposite

      Logger.info('Split selfie composites built', {
        generationId,
        hasFaceComposite: !!faceComposite,
        hasBodyComposite: !!bodyComposite,
        hasCombinedComposite: !!selfieComposite
      })
    }

    const payload = await buildDefaultReferencePayload({
      styleSettings: effectiveSettings,
      selfieKeys,
      getSelfieBuffer,
      downloadAsset: (key) => downloadAssetAsBase64({ bucketName, s3Client, key }),
      generationId,
      shotDescription: shotText,
      aspectRatioDescription,
      aspectRatioSize: { width: ratioConfig.width, height: ratioConfig.height },
      workflowVersion: options.workflowVersion
    })
    const referenceImages = payload.referenceImages
    const labelInstruction = payload.labelInstruction

    // Use element composition system to build payload

    const elementContext = {
      phase: 'person-generation' as const,
      settings: effectiveSettings,
      generationContext: {
        selfieS3Keys: selfieKeys,
        userId: personId,
        generationId,
      },
      existingContributions: [],
    }

    const contributions = await compositionRegistry.composeContributions(elementContext)

    const promptString = JSON.stringify(contributions.payload, null, 2)

    return {
      prompt: promptString,
      mustFollowRules: contributions.mustFollow || [],
      freedomRules: contributions.freedom || [],
      referenceImages,
      labelInstruction,
      aspectRatio,
      aspectRatioDescription,
      // Split selfie composites for focused reference
      faceComposite,
      bodyComposite,
      selfieComposite
    }
  }
}


